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

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function Analysis({ transactions }: Props) {
  const m = thisMonth()
  const now = transactions.filter((t) => monthKey(t.date) === m && t.type === 'expense')
  const prevKey = prevMonthKey(m)
  const prevTotal = transactions
    .filter((t) => monthKey(t.date) === prevKey && t.type === 'expense')
    .reduce((a, t) => a + t.amount, 0)
  const total = now.reduce((a, t) => a + t.amount, 0)

  const small = now.filter((t) => t.amount <= 500)

  const merchantCounts: Record<string, number> = {}
  now.forEach((t) => {
    const name = t.merchants?.canonical_name || '未設定'
    merchantCounts[name] = (merchantCounts[name] || 0) + 1
  })
  const topMerchant = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0]

  const weekdayTotals = WEEKDAYS.map((_, i) =>
    now
      .filter((t) => new Date(t.date + 'T00:00:00').getDay() === i)
      .reduce((a, t) => a + t.amount, 0)
  )
  const maxWeekday = Math.max(...weekdayTotals, 1)

  return (
    <>
      <div className="section-head">
        <h2>支出分析</h2>
        <div className="month">{formatMonthLabel(m)}</div>
      </div>

      <section className="card">
        <div className="insight">
          <strong>
            {prevTotal
              ? `前月比 ${total - prevTotal >= 0 ? '+' : ''}${yen(total - prevTotal)}`
              : '前月データがありません'}
          </strong>
          <p>登録された実データをもとに前月との差を表示します。</p>
        </div>
        <div className="insight">
          <strong>
            小額支出：{small.length}回 / {yen(small.reduce((a, t) => a + t.amount, 0))}
          </strong>
          <p>500円以下の利用回数と合計です。</p>
        </div>
        <div className="insight">
          <strong>
            {topMerchant
              ? `最も利用した店舗：${topMerchant[0]}（${topMerchant[1]}回）`
              : '利用店舗のデータがありません'}
          </strong>
          <p>今月の利用回数が多い店舗です。</p>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>曜日別支出</h2>
        </div>
        <div className="chart">
          {weekdayTotals.map((v, i) => (
            <div className="col" key={i}>
              <i style={{ height: `${Math.max((v / maxWeekday) * 105, v ? 8 : 2)}px` }} />
              <span>{WEEKDAYS[i]}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
