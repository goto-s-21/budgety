import { supabase } from '../supabase'
import type { ColumnMapping } from './columnMapper'
import { parseAmount, parseDateFlexible } from './columnMapper'

export interface StagedRow {
  rowIndex: number
  raw: Record<string, string>
  date: string | null
  amount: number | null
  merchantName: string | null
  memo: string | null
  status: 'ok' | 'needs_review' | 'duplicate'
  duplicateReason?: string
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

interface ExistingKey {
  date: string
  amount: number
  merchantName: string
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

  const existingKeys: ExistingKey[] = (data || []).map((t: any) => ({
    date: t.date,
    amount: Number(t.amount),
    merchantName: (t.merchants?.canonical_name || '').trim().toLowerCase(),
  }))

  return staged.map((row) => {
    if (row.status !== 'ok' || !row.date || row.amount === null || !row.merchantName) return row

    const isDuplicate = existingKeys.some(
      (k) =>
        k.date === row.date &&
        k.amount === row.amount &&
        k.merchantName === row.merchantName!.trim().toLowerCase()
    )

    if (isDuplicate) {
      return { ...row, status: 'duplicate', duplicateReason: '重複の可能性があります' }
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
  categoryMap: Record<number, string> = {}
): Promise<ImportResult> {
  let importedCount = 0
  let duplicateCount = 0
  let failedCount = 0

  for (const row of staged) {
    if (row.status === 'duplicate') {
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
      })
      if (error) throw error
      importedCount++
    } catch (e) {
      failedCount++
    }
  }

  await supabase.from('import_history').insert({
    user_id: userId,
    source: 'csv',
    filename,
    service_name: serviceName,
    imported_count: importedCount,
    duplicate_count: duplicateCount,
    failed_count: failedCount,
  })

  return { importedCount, duplicateCount, failedCount }
}