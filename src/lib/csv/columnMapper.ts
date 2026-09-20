export type FieldKey = 'date' | 'time' | 'amount' | 'merchant' | 'memo'

export const FIELD_LABELS: Record<FieldKey, string> = {
  date: '日付',
  time: '時間',
  amount: '金額',
  merchant: '利用先',
  memo: 'メモ',
}

const CANDIDATES: Record<FieldKey, string[]> = {
  date: ['利用日', '利用年月日', '取引日', 'ご利用日', '日付', '購入日', 'ご利用年月日', 'date', 'transaction date'],
  time: ['利用時間', '時間', 'time'],
  amount: ['利用金額', '金額', '支払金額', 'ご請求金額', 'お支払い金額', '合計', 'amount', 'price', 'total'],
  merchant: ['利用店名', '店舗', '利用先', '加盟店名', 'ご利用先', 'store', 'merchant', 'shop'],
  memo: ['メモ', '備考', 'note', 'memo', 'remarks'],
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/[\s　]/g, '')
}

export type ColumnMapping = Partial<Record<FieldKey, string>>

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalize(h) }))

  for (const field of Object.keys(CANDIDATES) as FieldKey[]) {
    const candidates = CANDIDATES[field].map(normalize)
    const match = normalizedHeaders.find((h) =>
      candidates.some((c) => h.normalized === c || h.normalized.includes(c))
    )
    if (match) {
      mapping[field] = match.original
    }
  }

  return mapping
}

export function isMappingComplete(mapping: ColumnMapping) {
  return Boolean(mapping.date && mapping.amount && mapping.merchant)
}

export function parseAmount(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[¥,\s円]/g, '').replace(/^\((.+)\)$/, '-$1')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

export function parseDateFlexible(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()

  let match = trimmed.match(/^(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})日?/)
  if (match) {
    const [, y, m, d] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (match) {
    const [, m, d, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}