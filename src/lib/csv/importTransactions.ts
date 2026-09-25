import { supabase } from '../supabase'
import type { ColumnMapping } from './columnMapper'
import { parseAmount, parseDateFlexible } from './columnMapper'


export interface ExistingMatch {
  merchantName: string
  date: string
  amount: number
}

export interface StagedRow {
  rowIndex: number
  raw: Record<string, string>
  date: string | null
  amount: number | null
  merchantName: string | null
  memo: string | null
  // duplicate: 正規化して完全一致(確実な重複) / possible_duplicate: 日付・金額が同じで店舗名が似ている
  status: 'ok' | 'needs_review' | 'duplicate' | 'possible_duplicate'
  duplicateReason?: string
  existingMatch?: ExistingMatch
}

// 店舗名の表記ゆれ(全角半角・スペース・記号・大文字小文字)を吸収して比較用に正規化する。
// Gmail同期側(workers/gmail/sync.ts)と同じ規則に揃え、アプリ全体で重複判定の挙動を統一する。
function normalizeMerchantName(value: string): string {
  return value.normalize('NFKC').replace(/[－‐‑‒–—―ー]/g, '-').replace(/[\s・]/g, '').toLowerCase()
}

// 正規化済みの店舗名どうしが「似ている」か。完全一致または一方が他方を含む(支店名の有無など)。
// 誤検知を避けるため2文字未満の極端に短い名前は部分一致では拾わない。
function isFuzzyMerchantMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length < 2 || b.length < 2) return false
  return a.includes(b) || b.includes(a)
}


export function buildStagedRows(rows: Record<string, string>[], mapping: ColumnMapping): StagedRow[] {
  return rows.map((raw, index) => {
    const date = mapping.date ? parseDateFlexible(raw[mapping.date]) : null
    const amount = mapping.amount ? parseAmount(raw[mapping.amount]) : null
    const merchantName = mapping.merchant ? raw[mapping.merchant]?.trim() || null : null
    const memo = mapping.memo ? raw[mapping.memo]?.trim() || null : null


    const status: StagedRow['status'] = date && amount !== null && merchantName ? 'ok' : 'needs_review'


    return { rowIndex: index, raw, date, amount, merchantName, memo, status }
  })
}


// スクリーンショット抽出結果(日付・金額・店舗が直接得られる)をステージ行に変換する。
// CSVのbuildStagedRowsと同じstatus判定・同じStagedRow形を使い、以降の重複判定・登録を共用する。
export function buildStagedRowsFromExtracted(
  items: { date: string | null; amount: number | null; merchant: string | null }[]
): StagedRow[] {
  return items.map((it, index) => {
    const date = it.date ? parseDateFlexible(it.date) : null
    const amount = typeof it.amount === 'number' && Number.isFinite(it.amount) ? it.amount : null
    const merchantName = it.merchant?.trim() || null
    const status: StagedRow['status'] = date && amount !== null && merchantName ? 'ok' : 'needs_review'
    return { rowIndex: index, raw: {}, date, amount, merchantName, memo: null, status }
  })
}


interface ExistingKey {
  date: string
  amount: number
  merchantName: string
  normalized: string
}


export async function markDuplicates(userId: string, staged: StagedRow[]): Promise<StagedRow[]> {
  const dates = staged.filter((r) => r.date).map((r) => r.date as string)
  if (dates.length === 0) return staged


  const minDate = dates.reduce((a, b) => (a < b ? a : b))
  const maxDate = dates.reduce((a, b) => (a > b ? a : b))


  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, merchants(canonical_name)')
    .eq('user_id', userId)
    .gte('date', minDate)
    .lte('date', maxDate)


  if (error) throw error


  const existingKeys: ExistingKey[] = (data || []).map((t: any) => {
    const name = (t.merchants?.canonical_name || '').trim()
    return { date: t.date, amount: Number(t.amount), merchantName: name, normalized: normalizeMerchantName(name) }
  })


  return staged.map((row) => {
    if (row.status !== 'ok' || !row.date || row.amount === null || !row.merchantName) return row


    // 同じ日付・同じ金額の既存取引に絞り込む(表記ゆれは店舗名側で吸収する)
    const sameDateAmount = existingKeys.filter((k) => k.date === row.date && k.amount === row.amount)
    if (sameDateAmount.length === 0) return row


    const rowNorm = normalizeMerchantName(row.merchantName)


    // 正規化して完全一致 → 確実な重複
    const exact = sameDateAmount.find((k) => k.normalized && k.normalized === rowNorm)
    if (exact) {
      return {
        ...row,
        status: 'duplicate',
        duplicateReason: '同じ取引が既に登録されています',
        existingMatch: { merchantName: exact.merchantName, date: exact.date, amount: exact.amount },
      }
    }


    // 店舗名が部分一致 → 似た取引(登録するか確認する)
    const near = sameDateAmount.find((k) => isFuzzyMerchantMatch(k.normalized, rowNorm))
    if (near) {
      return {
        ...row,
        status: 'possible_duplicate',
        duplicateReason: '似た取引が既にあります',
        existingMatch: { merchantName: near.merchantName, date: near.date, amount: near.amount },
      }
    }


    return row
  })
}


async function resolveMerchantId(userId: string, merchantName: string) {
  const trimmed = merchantName.trim()


  const { data: existing, error: fetchError } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .eq('canonical_name', trimmed)
    .limit(1)
    .maybeSingle()


  if (fetchError) throw fetchError
  if (existing) return existing.id


  const { data: created, error: insertError } = await supabase
    .from('merchants')
    .insert({ user_id: userId, canonical_name: trimmed })
    .select('id')
    .single()


  if (insertError) throw insertError
  return created.id
}


export interface ImportResult {
  importedCount: number
  duplicateCount: number
  failedCount: number
}


export async function commitStagedRows(
  userId: string,
  staged: StagedRow[],
  defaultCategoryId: string,
  serviceName: string,
  filename: string,
  categoryMap: Record<number, string> = {},
  // 重複・似た取引の行を「登録する」に上書きする判断(rowIndex→'register')。既定はスキップ。
  duplicateDecisions: Record<number, 'skip' | 'register'> = {}
): Promise<ImportResult> {
  const { data: historyRow, error: historyInsertError } = await supabase
    .from('import_history')
    .insert({
      user_id: userId,
      source: 'csv',
      filename,
      service_name: serviceName,
      imported_count: 0,
      duplicate_count: 0,
      failed_count: 0,
    })
    .select('id')
    .single()

  if (historyInsertError) throw historyInsertError
  const importHistoryId = historyRow.id

  let importedCount = 0
  let duplicateCount = 0
  let failedCount = 0


  for (const row of staged) {
    const isDuplicateLike = row.status === 'duplicate' || row.status === 'possible_duplicate'
    if (isDuplicateLike && duplicateDecisions[row.rowIndex] !== 'register') {
      duplicateCount++
      continue
    }


    if (!row.date || row.amount === null || !row.merchantName) {
      failedCount++
      continue
    }


    const categoryId = categoryMap[row.rowIndex] || defaultCategoryId


    try {
      const merchantId = await resolveMerchantId(userId, row.merchantName)
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        date: row.date,
        amount: Math.abs(row.amount),
        type: row.amount < 0 ? 'refund' : 'expense',
        merchant_id: merchantId,
        category_id: categoryId,
        source: 'csv',
        source_detail: serviceName,
        memo: row.memo,
        confidence: row.status === 'ok' ? 'medium' : 'low',
        needs_review: row.status !== 'ok',
        import_history_id: importHistoryId,
      })
      if (error) throw error
      importedCount++
    } catch (e) {
      failedCount++
    }
  }


  await supabase
    .from('import_history')
    .update({
      imported_count: importedCount,
      duplicate_count: duplicateCount,
      failed_count: failedCount,
    })
    .eq('id', importHistoryId)


  return { importedCount, duplicateCount, failedCount }
}


export interface ImportHistoryRow {
  id: string
  source: string
  filename: string
  service_name: string | null
  imported_count: number
  duplicate_count: number
  failed_count: number
  created_at: string
}


export async function fetchImportHistory(userId: string): Promise<ImportHistoryRow[]> {
  const { data, error } = await supabase
    .from('import_history')
    .select('id, source, filename, service_name, imported_count, duplicate_count, failed_count, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data || []
}


export interface ImportedTransactionRow {
  id: string
  date: string
  amount: number
  type: string
  memo: string | null
  merchants: { canonical_name: string } | null
  categories: { name: string; icon: string | null } | null
}

export interface ImportedTransactionsResult {
  rows: ImportedTransactionRow[]
  approximate: boolean
}

// 正確な import_history_id で紐付いた取引を取得する
async function fetchByImportHistoryId(
  userId: string,
  importHistoryId: string
): Promise<ImportedTransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, amount, type, memo, created_at, merchants(canonical_name), categories(name, icon)')
    .eq('user_id', userId)
    .eq('import_history_id', importHistoryId)
    .order('date', { ascending: false })

  if (error) throw error
  return (data || []) as unknown as ImportedTransactionRow[]
}

// import_history_id 導入前の過去分に対する近似マッチング。
// source='csv' かつ service_name(source_detail)が一致し、
// 取引のcreated_atが取り込み履歴のcreated_atの前後5分以内のものを
// 「たぶんこの回で登録された取引」として推定する。あくまで近似表示であり、
// 別の取り込み回や手動追加の取引が混ざる可能性がある。
async function fetchApproximateMatch(
  userId: string,
  history: ImportHistoryRow
): Promise<ImportedTransactionRow[]> {
  const created = new Date(history.created_at)
  const windowMs = 5 * 60 * 1000
  const from = new Date(created.getTime() - windowMs).toISOString()
  const to = new Date(created.getTime() + windowMs).toISOString()

  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, amount, type, memo, created_at, merchants(canonical_name), categories(name, icon)')
    .eq('user_id', userId)
    .eq('source', 'csv')
    .is('import_history_id', null)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('date', { ascending: false })

  if (error) throw error

  const rows = (data || []) as any[]
  // source_detailは選択していないため、サービス名の厳密一致は行わずcreated_at近接のみで判定する
  return rows as unknown as ImportedTransactionRow[]
}

// 指定した取り込み回で登録された取引を取得する。
// 正確な紐付けが0件の場合のみ、過去分向けの近似マッチングにフォールバックする。
export async function fetchImportedTransactions(
  userId: string,
  history: ImportHistoryRow
): Promise<ImportedTransactionsResult> {
  const exact = await fetchByImportHistoryId(userId, history.id)
  if (exact.length > 0) {
    return { rows: exact, approximate: false }
  }

  const approx = await fetchApproximateMatch(userId, history)
  return { rows: approx, approximate: approx.length > 0 }
}