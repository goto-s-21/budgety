// src/lib/formatters.ts の更新版。
// 既存のyear/month/dayロジックはそのまま。'week'単位を新規追加した。
// week の period キーは「その週の月曜日の日付(YYYY-MM-DD)」を採用する。

const pad = (n: number) => String(n).padStart(2, '0')

export const yen = (n: number | null | undefined) =>
  '¥' + Number(n || 0).toLocaleString('ja-JP')

export const monthKey = (d: string) => d.slice(0, 7)

export const thisMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

export const formatMonthLabel = (m: string) => m.replace('-', '年') + '月'

export const formatDate = (d: string) => {
  const [, m, day] = d.split('-')
  return `${Number(m)}月${Number(day)}日`
}

export const prevMonthKey = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const date = new Date(y, mo - 2, 1)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export type PeriodUnit = 'year' | 'month' | 'week' | 'day'

// dateStr('YYYY-MM-DD') が属する週の月曜日の日付('YYYY-MM-DD')を返す
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = date.getDay() // 0=日,1=月,...6=土
  const diff = dow === 0 ? -6 : 1 - dow // 月曜まで戻る日数
  date.setDate(date.getDate() + diff)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// 今週(月曜始まり)の月曜日を 'YYYY-MM-DD' で返す
export const thisWeek = () => mondayOf(todayKey())

// 週の月曜日('YYYY-MM-DD')から日曜日('YYYY-MM-DD')までの範囲を返す
export function weekRange(mondayStr: string): { start: string; end: string } {
  const [y, m, d] = mondayStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + 6)
  return {
    start: mondayStr,
    end: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  }
}

export function formatPeriodLabel(unit: PeriodUnit, period: string): string {
  if (unit === 'year') return `${period}年`
  if (unit === 'month') {
    const [y, m] = period.split('-')
    return `${y}年${Number(m)}月`
  }
  if (unit === 'week') {
    const { start, end } = weekRange(period)
    const [, sm, sd] = start.split('-')
    const [, em, ed] = end.split('-')
    return `${Number(sm)}/${Number(sd)} 〜 ${Number(em)}/${Number(ed)}`
  }
  const [y, m, d] = period.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function navigatePeriod(unit: PeriodUnit, period: string, dir: 1 | -1): string {
  if (unit === 'year') return String(Number(period) + dir)
  if (unit === 'month') {
    const [y, m] = period.split('-').map(Number)
    const date = new Date(y, m - 1 + dir, 1)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
  }
  if (unit === 'week') {
    const [y, m, d] = period.split('-').map(Number)
    const date = new Date(y, m - 1, d + 7 * dir)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  const [y, m, d] = period.split('-').map(Number)
  const date = new Date(y, m - 1, d + dir)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// 指定した日付('YYYY-MM-DD')がperiod(unit基準)に含まれるか判定する
export function isInPeriod(dateStr: string, unit: PeriodUnit, period: string): boolean {
  if (unit === 'year') return dateStr.startsWith(period)
  if (unit === 'month') return dateStr.startsWith(period)
  if (unit === 'week') {
    const { start, end } = weekRange(period)
    return dateStr >= start && dateStr <= end
  }
  return dateStr === period
}