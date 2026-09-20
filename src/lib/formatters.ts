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