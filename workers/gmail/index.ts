import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { findParser } from './parsers'
import type { GmailMessage, ParsedTransaction } from './types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SyncResult {
  userId: string
  fetchedCount: number
  parsedCount: number
  importedCount: number
  duplicateCount: number
  failedCount: number
}

async function getGmailClient(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64').toString('utf-8')
}

function extractBody(payload: any): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }
  return ''
}

function getHeader(headers: any[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

async function fetchMessagesSince(gmail: any, sinceDate: Date): Promise<GmailMessage[]> {
  const query = `after:${Math.floor(sinceDate.getTime() / 1000)}`
  const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100 })
  const messageRefs = listRes.data.messages || []

  const messages: GmailMessage[] = []
  for (const ref of messageRefs) {
    const detail = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'full' })
    const headers = detail.data.payload?.headers || []
    messages.push({
      id: detail.data.id!,
      from: getHeader(headers, 'From'),
      subject: getHeader(headers, 'Subject'),
      body: extractBody(detail.data.payload),
      internalDate: detail.data.internalDate!,
    })
  }
  return messages
}

async function resolveMerchantId(userId: string, merchantName: string) {
  const trimmed = merchantName.trim()
  const { data: existing } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .eq('canonical_name', trimmed)
    .limit(1)
    .maybeSingle()
  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('merchants')
    .insert({ user_id: userId, canonical_name: trimmed })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

async function isDuplicate(userId: string, tx: ParsedTransaction): Promise<boolean> {
  const { data: bySourceId } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'gmail')
    .eq('source_id', tx.sourceId)
    .limit(1)
    .maybeSingle()
  if (bySourceId) return true

  if (!tx.date || tx.amount === null || !tx.merchant) return false

  const { data: matches } = await supabase
    .from('transactions')
    .select('id, merchants(canonical_name)')
    .eq('user_id', userId)
    .eq('date', tx.date)
    .eq('amount', Math.abs(tx.amount))

  const normalizedMerchant = tx.merchant.trim().toLowerCase()
  return (matches || []).some(
    (m: any) => (m.merchants?.canonical_name || '').trim().toLowerCase() === normalizedMerchant
  )
}

async function syncUserGmail(userId: string, refreshToken: string): Promise<SyncResult> {
  const result: SyncResult = {
    userId,
    fetchedCount: 0,
    parsedCount: 0,
    importedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
  }

  const { data: state } = await supabase
    .from('gmail_sync_state')
    .select('last_synced_at')
    .eq('user_id', userId)
    .maybeSingle()

  const sinceDate = state?.last_synced_at
    ? new Date(state.last_synced_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000)

  const gmail = await getGmailClient(refreshToken)
  const messages = await fetchMessagesSince(gmail, sinceDate)
  result.fetchedCount = messages.length

  const syncStartedAt = new Date().toISOString()

  for (const message of messages) {
    const parser = findParser(message)
    if (!parser) continue

    const parsed = parser.parse(message)
    if (!parsed) {
      result.failedCount++
      continue
    }
    result.parsedCount++

    const duplicate = await isDuplicate(userId, parsed)
    if (duplicate) {
      result.duplicateCount++
      continue
    }

    if (!parsed.date || parsed.amount === null || !parsed.merchant) {
      result.failedCount++
      continue
    }

    try {
      const merchantId = await resolveMerchantId(userId, parsed.merchant)
      const { data: defaultCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .eq('name', '未分類')
        .maybeSingle()

      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        date: parsed.date,
        time: parsed.time,
        amount: Math.abs(parsed.amount),
        type: 'expense',
        merchant_id: merchantId,
        category_id: defaultCategory?.id,
        source: 'gmail',
        source_id: parsed.sourceId,
        source_detail: parser.serviceName,
        confidence: 'medium',
        needs_review: false,
      })
      if (error) throw error
      result.importedCount++
    } catch {
      result.failedCount++
    }
  }

  await supabase
    .from('gmail_sync_state')
    .upsert({ user_id: userId, last_synced_at: syncStartedAt })

  await supabase.from('import_history').insert({
    user_id: userId,
    source: 'gmail',
    filename: null,
    service_name: 'gmail-sync',
    imported_count: result.importedCount,
    duplicate_count: result.duplicateCount,
    failed_count: result.failedCount,
  })

  return result
}

async function main() {
  const { data: connections, error } = await supabase
    .from('gmail_connections')
    .select('user_id, refresh_token')
    .eq('status', 'active')

  if (error) {
    console.error('Failed to fetch gmail_connections:', error)
    process.exit(1)
  }

  for (const conn of connections || []) {
    try {
      const result = await syncUserGmail(conn.user_id, conn.refresh_token)
      console.log(`User ${conn.user_id}:`, result)
    } catch (err) {
      console.error(`User ${conn.user_id} sync failed:`, err)
    }
  }
}

main()
