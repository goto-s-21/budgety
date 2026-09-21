export const yen = (n: number | null | undefined) =>
  '¥' + Number(n || 0).toLocaleString('ja-JP')

export const monthKey = (d: string) => d.slice(0, 7)

export const thisMonth = () => new Date().toISOString().slice(0, 7)

export const formatMonthLabel = (m: string) => m.replace('-', '年') + '月'

export const formatDate = (d: string) => {
  const [, m, day] = d.split('-')
  return `${Number(m)}月${Number(day)}日`
}

export const prevMonthKey = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const date = new Date(y, mo - 2, 1)
  return date.toISOString().slice(0, 7)
}

export const todayKey = () => new Date().toISOString().slice(0, 10)

export type PeriodUnit = 'year' | 'month' | 'day'

export function formatPeriodLabel(unit: PeriodUnit, period: string): string {
  if (unit === 'year') return `${period}年`
  if (unit === 'month') {
    const [y, m] = period.split('-')
    return `${y}年${Number(m)}月`
  }
  const [y, m, d] = period.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function navigatePeriod(unit: PeriodUnit, period: string, dir: 1 | -1): string {
  if (unit === 'year') return String(Number(period) + dir)
  if (unit === 'month') {
    const [y, m] = period.split('-').map(Number)
    const date = new Date(y, m - 1 + dir, 1)
    return date.toISOString().slice(0, 7)
  }
  const date = new Date(period + 'T00:00:00')
  date.setDate(date.getDate() + dir)
  return date.toISOString().slice(0, 10)
}