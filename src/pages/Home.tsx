import { yen, monthKey, thisMonth } from '../lib/formatters'

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
  onSeeAnalysis: () => void
  onSeeHistory: () => void
}

export default function Home({ transactions, onSeeAnalysis, onSeeHistory }: Props) {
  const m = thisMonth()
  const now = transactions.filter((t) => monthKey(t.date) === m)
  const income = now.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const expense = now.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

  const catTotals: Record<string, number> = {}
  now
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const name = t.categories?.name || '未分類'
      catTotals[name] = (catTotals[name] || 0) + t.amount
    })
  const catRows = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
  const maxCat = catRows[0]?.[1] || 1

  const recent = transactions
    .filter((t) => t.type === 'expense')
    .slice(0, 3)

  return (
    <>
      <section className="hero">
        <div className="eyebrow">今月の残り</div>
        <div className="balance">{yen(income - expense)}</div>
        <div className="stats">
          <div className="stat">
            <label>今月の収入</label>
            <strong>{yen(income)}</strong>
          </div>
          <div className="stat">
            <label>今月の支出</label>
            <strong>{yen(expense)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>MY SPENDING</h2>
          <button onClick={onSeeAnalysis}>詳しく見る</button>
        </div>
        {catRows.length === 0 && <div className="empty">支出を追加すると表示されます。</div>}
        {catRows.slice(0, 5).map(([name, value]) => (
          <div className="spend-row" key={name}>
            <div className="icon">🧾</div>
            <div className="grow">
              <div className="name">{name}</div>
              <div className="bar">
                <i style={{ width: `${Math.min(100, (value / maxCat) * 100)}%` }} />
              </div>
            </div>
            <div className="amount">{yen(value)}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>最近の支出</h2>
          <button onClick={onSeeHistory}>すべて見る</button>
        </div>
        {recent.length === 0 && <div className="empty">まだ記録がありません。</div>}
        {recent.map((t) => (
          <div className="tx" key={t.id}>
            <div className="icon">{t.categories?.icon || '🧾'}</div>
            <div className="grow">
              <div className="name">{t.merchants?.canonical_name || '未設定'}</div>
              <div className="sub">{t.categories?.name || '未分類'}</div>
            </div>
            <div className="amount">-{yen(t.amount)}</div>
          </div>
        ))}
      </section>
    </>
  )
}