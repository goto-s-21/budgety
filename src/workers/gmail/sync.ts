import { createClient } from '@supabase/supabase-js'
import { refreshAccessToken, fetchMessagesSince } from '../../lib/gmail/gmailClient'
import { parseMessage } from '../../lib/gmail/parsers'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function formatGmailDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function normalizeMerchantName(value: string): string {
  return value.normalize('NFKC').replace(/[－‐‑‒–—―ー]/g, '-').replace(/[\s・]/g, '').toLowerCase()
}

function normalizeCategoryMerchantName(value: string): string {
  return normalizeMerchantName(value)
}

async function resolveMerchantId(userId: string, merchantName: string): Promise<string | null> {
  const normalized = normalizeMerchantName(merchantName)
  const { data: existing, error: findError } = await supabase.from('merchants').select('id, canonical_name').eq('user_id', userId)
  if (findError) throw findError
  const match = (existing || []).find((merchant: any) => {
    const name = normalizeMerchantName(merchant.canonical_name || '')
    return name && (name.includes(normalized) || normalized.includes(name))
  })
  if (match) return match.id
  const { data, error } = await supabase.from('merchants').insert({ user_id: userId, canonical_name: merchantName }).select('id').single()
  if (error) throw error
  return data?.id || null
}

async function resolveCategoryId(userId: string, merchantName: string, uncategorizedId: string | null): Promise<string | null> {
  const normalized = normalizeCategoryMerchantName(merchantName)
  const convenienceStoreKeywords = ['セブン-イレブン', 'セブンイレブン', '7-eleven', '7eleven', 'ファミリーマート', 'ファミマ', 'familymart', 'ローソン', 'lawson', 'ローソンストア100', 'lawsonstore100', 'ミニストップ', 'ministop', 'デイリーヤマザキ', 'dailyyamazaki', 'ニューデイズ', 'newdays', 'トモニー', 'tomony', 'キヨスク', 'キオスク', 'kiosk']
  const restaurantKeywords = ['マクドナルド', 'マック', "mcdonald's", 'mcdonalds']
  let categoryName: string | null = null
  if (convenienceStoreKeywords.some((keyword) => normalized.includes(normalizeCategoryMerchantName(keyword)))) categoryName = 'コンビニ'
  if (restaurantKeywords.some((keyword) => normalized.includes(normalizeCategoryMerchantName(keyword)))) categoryName = '外食'
  if (!categoryName) return uncategorizedId
  const { data, error } = await supabase.from('categories').select('id').eq('user_id', userId).eq('name', categoryName).limit(1).maybeSingle()
  if (error) throw error
  return data?.id || uncategorizedId
}

async function isDuplicateBySourceId(userId: string, sourceId: string): Promise<boolean> {
  const { data, error } = await supabase.from('transactions').select('id').eq('user_id', userId).eq('source', 'gmail').eq('source_id', sourceId).limit(1).maybeSingle()
  if (error) throw error
  return !!data
}

async function isDuplicateByDateAmountMerchant(input: { userId: string; date: string; amount: number; merchantName: string }): Promise<boolean> {
  if (input.amount < 111) return false
  const { data, error } = await supabase.from('transactions').select('id, amount, date, merchants(canonical_name)').eq('user_id', input.userId).eq('date', input.date).eq('amount', input.amount)
  if (error) throw error
  const targetMerchantName = normalizeMerchantName(input.merchantName)
  if (!targetMerchantName) return false
  return (data || []).some((row: any) => {
    const existingMerchantName = normalizeMerchantName(row.merchants?.canonical_name || '')
    return !!existingMerchantName && (existingMerchantName.includes(targetMerchantName) || targetMerchantName.includes(existingMerchantName))
  })
}

async function syncUser(connection: { user_id: string; refresh_token: string; last_synced_at: string | null }) {
  const userId = connection.user_id
  let accessToken: string
  try {
    const refreshed = await refreshAccessToken(connection.refresh_token)
    accessToken = refreshed.accessToken
    await supabase.from('gmail_connections').update({ access_token: refreshed.accessToken, token_expires_at: refreshed.expiresAt.toISOString(), status: 'active' }).eq('user_id', userId)
  } catch (e) {
    await supabase.from('gmail_connections').update({ status: 'expired' }).eq('user_id', userId)
    console.error(`[gmail-sync] user=${userId} refresh_token失効:`, e)
    return
  }

  const since = connection.last_synced_at ? new Date(new Date(connection.last_synced_at).getTime() - 24 * 60 * 60 * 1000) : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const messages = await fetchMessagesSince(accessToken, formatGmailDate(since))
  const { data: uncategorized, error: categoryError } = await supabase.from('categories').select('id').eq('user_id', userId).eq('name', '未分類').limit(1).maybeSingle()
  if (categoryError) throw categoryError

  let importedCount = 0
  let duplicateCount = 0
  let failedCount = 0
  const detailRows: Array<Record<string, unknown>> = []

  for (const message of messages) {
    console.log(`[gmail-sync] message id=${message.id} from=${message.from} subject=${message.subject}`)
    const parsed = parseMessage(message)
    if (!parsed) {
      failedCount++
      detailRows.push({ user_id: userId, source_id: message.id || null, message_subject: message.subject || null, message_from: message.from || null, result: 'failed', error_message: 'メールを取引として解析できませんでした' })
      continue
    }

    try {
      if (await isDuplicateBySourceId(userId, parsed.sourceId)) {
        duplicateCount++
        detailRows.push({ user_id: userId, source_id: parsed.sourceId, message_subject: message.subject || null, message_from: message.from || null, merchant_name: parsed.merchant, transaction_date: parsed.date, amount: parsed.amount, result: 'duplicate', error_message: '同じGmailメールは登録済みです' })
        continue
      }
      if (await isDuplicateByDateAmountMerchant({ userId, date: parsed.date, amount: parsed.amount, merchantName: parsed.merchant })) {
        duplicateCount++
        detailRows.push({ user_id: userId, source_id: parsed.sourceId, message_subject: message.subject || null, message_from: message.from || null, merchant_name: parsed.merchant, transaction_date: parsed.date, amount: parsed.amount, result: 'duplicate', error_message: '同日・同額・同店舗の取引が登録済みです' })
        continue
      }
      const merchantId = await resolveMerchantId(userId, parsed.merchant)
      const categoryId = await resolveCategoryId(userId, parsed.merchant, uncategorized?.id || null)
      const { error: insertError } = await supabase.from('transactions').insert({ user_id: userId, date: parsed.date, time: parsed.time, amount: parsed.amount, type: 'expense', merchant_id: merchantId, category_id: categoryId, source: 'gmail', source_id: parsed.sourceId, source_detail: parsed.sourceDetail, confidence: 'medium', needs_review: false })
      if (insertError) throw insertError
      importedCount++
      detailRows.push({ user_id: userId, source_id: parsed.sourceId, message_subject: message.subject || null, message_from: message.from || null, merchant_name: parsed.merchant, transaction_date: parsed.date, amount: parsed.amount, result: 'imported' })
    } catch (e) {
      failedCount++
      detailRows.push({ user_id: userId, source_id: parsed.sourceId, message_subject: message.subject || null, message_from: message.from || null, merchant_name: parsed.merchant, transaction_date: parsed.date, amount: parsed.amount, result: 'failed', error_message: e instanceof Error ? e.message : String(e) })
      console.error(`[gmail-sync] user=${userId} 登録失敗:`, e)
    }
  }

  let importHistoryId: string | null = null
  if (importedCount > 0 || duplicateCount > 0 || failedCount > 0) {
    const { data: history, error: historyError } = await supabase.from('import_history').insert({ user_id: userId, source: 'gmail', filename: 'gmail-sync', service_name: 'Gmail自動連携', imported_count: importedCount, duplicate_count: duplicateCount, failed_count: failedCount }).select('id').single()
    if (historyError) console.error(`[gmail-sync] user=${userId} 履歴保存失敗:`, historyError)
    importHistoryId = history?.id || null
  }

  if (importHistoryId && detailRows.length > 0) {
    const { error: detailError } = await supabase.from('gmail_sync_items').insert(detailRows.map((row) => ({ ...row, import_history_id: importHistoryId })))
    if (detailError) console.error(`[gmail-sync] user=${userId} 詳細一括保存失敗:`, detailError)
  }

  const now = new Date().toISOString()
  const { error: connectionUpdateError } = await supabase.from('gmail_connections').update({ last_synced_at: now }).eq('user_id', userId)
  if (connectionUpdateError) throw connectionUpdateError
  const { error: syncStateError } = await supabase.from('gmail_sync_state').upsert({ user_id: userId, last_synced_at: now, updated_at: now })
  if (syncStateError) throw syncStateError
  console.log(`[gmail-sync] user=${userId} 登録:${importedCount} 重複:${duplicateCount} 失敗:${failedCount}`)
}

async function main() {
  const { data: connections, error } = await supabase.from('gmail_connections').select('user_id, refresh_token, last_synced_at').eq('status', 'active')
  if (error) throw error
  if (!connections || connections.length === 0) {
    console.log('[gmail-sync] 有効なGmail連携がありません')
    return
  }
  for (const connection of connections) await syncUser(connection)
}

main().catch((e) => {
  console.error('[gmail-sync] 致命的エラー:', e)
  process.exit(1)
})
