// src/workers/gmail/sync.ts
// GitHub Actionsから直接実行するGmail同期スクリプト(Node.js)。
// 日本時間23:00に1日1回実行し、gmail_sync_state.last_synced_at以降の
// 差分メールを取得してパースし、transactionsへ登録する。
//
// 実行コマンド例: npx tsx src/workers/gmail/sync.ts

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
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[・･]/g, '')
    .trim()
}

async function resolveMerchantId(
  userId: string,
  merchantName: string
): Promise<string> {
  const trimmed = merchantName.trim()

  const { data: existing, error: findError } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .eq('canonical_name', trimmed)
    .limit(1)
    .maybeSingle()

  if (findError) throw findError
  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('merchants')
    .insert({
      user_id: userId,
      canonical_name: trimmed,
    })
    .select('id')
    .single()

  if (error) throw error
  return created.id
}

async function isDuplicateBySourceId(
  userId: string,
  sourceId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('source', 'gmail')
    .eq('source_id', sourceId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return !!data
}

async function isDuplicateByDateAmountMerchant(input: {
  userId: string
  date: string
  amount: number
  merchantName: string
}): Promise<boolean> {
  // 111円未満の取引はCSV重複判定の対象外
  if (input.amount < 111) {
    return false
  }

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      amount,
      date,
      merchants (
        canonical_name
      )
    `)
    .eq('user_id', input.userId)
    .eq('date', input.date)
    .eq('amount', input.amount)

  if (error) throw error

  const targetMerchantName = normalizeMerchantName(input.merchantName)

  if (!targetMerchantName) {
    return false
  }

  return (data || []).some((row: any) => {
    const existingMerchantName = normalizeMerchantName(
      row.merchants?.canonical_name || ''
    )

    if (!existingMerchantName) {
      return false
    }

    // 店舗名が部分一致していれば重複と判定する
    return (
      existingMerchantName.includes(targetMerchantName) ||
      targetMerchantName.includes(existingMerchantName)
    )
  })
}

async function syncUser(connection: {
  user_id: string
  refresh_token: string
  last_synced_at: string | null
}) {
  const userId = connection.user_id

  let accessToken: string

  try {
    const refreshed = await refreshAccessToken(connection.refresh_token)
    accessToken = refreshed.accessToken

    await supabase
      .from('gmail_connections')
      .update({
        access_token: refreshed.accessToken,
        token_expires_at: refreshed.expiresAt.toISOString(),
        status: 'active',
      })
      .eq('user_id', userId)
  } catch (e) {
    // refresh_tokenが失効している場合はexpiredにして次回以降スキップする
    await supabase
      .from('gmail_connections')
      .update({
        status: 'expired',
      })
      .eq('user_id', userId)

    console.error(`[gmail-sync] user=${userId} refresh_token失効:`, e)
    return
  }

  // 前回同期日時の前日から検索する。
  // 未同期の場合は3日前から検索する。
  // 多少重複して取得しても、source_idおよび
  // 日付・金額・店舗名の重複チェックで安全に処理する。
  const since = connection.last_synced_at
    ? new Date(
        new Date(connection.last_synced_at).getTime() -
          24 * 60 * 60 * 1000
      )
    : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  const messages = await fetchMessagesSince(
    accessToken,
    formatGmailDate(since)
  )

  const { data: uncategorized, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', '未分類')
    .limit(1)
    .maybeSingle()

  if (categoryError) {
    throw categoryError
  }

  let importedCount = 0
  let duplicateCount = 0
  let failedCount = 0

  for (const message of messages) {
    const parsed = parseMessage(message)

    // パース対象外のメールは無視する
    if (!parsed) {
      continue
    }

    try {
      // Gmailメール自体の重複チェック
      const duplicateBySourceId = await isDuplicateBySourceId(
        userId,
        parsed.sourceId
      )

      if (duplicateBySourceId) {
        duplicateCount++

        console.log(
          `[gmail-sync] source_id重複スキップ user=${userId} source_id=${parsed.sourceId}`
        )

        continue
      }

      // 既存のCSV・手入力データとの重複チェック
      // 111円以上の場合のみ、同日・同額・店舗名部分一致で判定する
      const duplicateByTransaction = await isDuplicateByDateAmountMerchant({
        userId,
        date: parsed.date,
        amount: parsed.amount,
        merchantName: parsed.merchant,
      })

      if (duplicateByTransaction) {
        duplicateCount++

        console.log(
          `[gmail-sync] 既存取引重複スキップ user=${userId} date=${parsed.date} amount=${parsed.amount} merchant=${parsed.merchant}`
        )

        continue
      }

      const merchantId = await resolveMerchantId(
        userId,
        parsed.merchant
      )

      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          date: parsed.date,
          time: parsed.time,
          amount: parsed.amount,
          type: 'expense',
          merchant_id: merchantId,
          category_id: uncategorized?.id || null,
          source: 'gmail',
          source_id: parsed.sourceId,
          source_detail: parsed.sourceDetail,
          confidence: 'medium',
          needs_review: false,
        })

      if (insertError) {
        throw insertError
      }

      importedCount++
    } catch (e) {
      failedCount++

      console.error(
        `[gmail-sync] user=${userId} 登録失敗:`,
        e
      )
    }
  }

  if (
    importedCount > 0 ||
    duplicateCount > 0 ||
    failedCount > 0
  ) {
    const { error: historyError } = await supabase
      .from('import_history')
      .insert({
        user_id: userId,
        source: 'gmail',
        filename: 'gmail-sync',
        service_name: 'Gmail自動連携',
        imported_count: importedCount,
        duplicate_count: duplicateCount,
        failed_count: failedCount,
      })

    if (historyError) {
      console.error(
        `[gmail-sync] user=${userId} 履歴保存失敗:`,
        historyError
      )
    }
  }

  const now = new Date().toISOString()

  const { error: connectionUpdateError } = await supabase
    .from('gmail_connections')
    .update({
      last_synced_at: now,
    })
    .eq('user_id', userId)

  if (connectionUpdateError) {
    throw connectionUpdateError
  }

  const { error: syncStateError } = await supabase
    .from('gmail_sync_state')
    .upsert({
      user_id: userId,
      last_synced_at: now,
      updated_at: now,
    })

  if (syncStateError) {
    throw syncStateError
  }

  console.log(
    `[gmail-sync] user=${userId} 登録:${importedCount} 重複:${duplicateCount} 失敗:${failedCount}`
  )
}

async function main() {
  const { data: connections, error } = await supabase
    .from('gmail_connections')
    .select('user_id, refresh_token, last_synced_at')
    .eq('status', 'active')

  if (error) {
    throw error
  }

  if (!connections || connections.length === 0) {
    console.log('[gmail-sync] 有効なGmail連携がありません')
    return
  }

  for (const connection of connections) {
    await syncUser(connection)
  }
}

main().catch((e) => {
  console.error('[gmail-sync] 致命的エラー:', e)
  process.exit(1)
})