import { yen, monthKey, thisMonth, prevMonthKey, formatMonthLabel } from '../lib/formatters'

interface TxRow {
  id: string
  type: string
  amount: number
  date: string
  merchants: { canonical_name: string } | null
  categories: { name: string; icon: string | null } | null
}

interface Props {
  transactions: TxRow[]
}

export default function Analysis({ transactions }: Props) {
  const m = thisMonth()
  const now = transactions.filter((t) => monthKey(t.date) === m && t.type === 'expense')
  const prevKey = prevMonthKey(m)
  const prevTotal = transactions
    .filter((t) => monthKey(t.date) === prevKey && t.type === 'expense')
    .reduce((a, t) => a + t.amount, 0)
  const total = now.reduce((a, t) => a + t.amount, 0)
  const small = now.filter((t) => t.amount < 500)
  const merchantCounts: Record<string, number> = {}

  now.forEach((t) => {
    const name = t.merchants?.canonical_name || '不明'
    merchantCounts[name] = (merchantCounts[name] || 0) + 1
  })

  const topMerchant = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div>
      <div className="section-head">
        <h2>分析</h2>
        <div className="month">{formatMonthLabel(m)}</div>
      </div>

      <section className="card">
        <div className="insight">
          <strong>{prevTotal ? yen(total - prevTotal) : '—'}</strong>
          <p>前月比</p>
        </div>
        <div className="insight">
          <strong>{yen(small.reduce((a, t) => a + t.amount, 0))}</strong>
          <p>500円未満の合計</p>
        </div>
        <div className="insight">
          <strong>{topMerchant ? topMerchant[0] : '—'}</strong>
          <p>最多利用店舗</p>
        </div>
      </section>
    </div>
  )
}
