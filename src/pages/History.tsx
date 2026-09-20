import { useState } from 'react'
import { yen, formatDate } from '../lib/formatters'

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
  onDelete: (id: string) => Promise<void>
  onAdd: () => void
}

type Filter = 'all' | 'expense' | 'income'

export default function History({ transactions, onDelete, onAdd }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const rows = transactions.filter((t) => filter === 'all' || t.type === filter)

  async function handleDelete(id: string) {
    if (confirm('この記録を削除しますか？')) {
      await onDelete(id)
    }
  }

  return (
    <>
      <div className="section-head">
        <h2>履歴</h2>
        <button onClick={onAdd}>＋追加</button>
      </div>

      <div className="tabs">
        <button className={filter === 'all' ? 'tab active' : 'tab'} onClick={() => setFilter('all')}>
          すべて
        </button>
        <button className={filter === 'expense' ? 'tab active' : 'tab'} onClick={() => setFilter('expense')}>
          支出
        </button>
        <button className={filter === 'income' ? 'tab active' : 'tab'} onClick={() => setFilter('income')}>
          収入
        </button>
      </div>

      <section className="card">
        {rows.length === 0 && <div className="empty">該当する記録がありません。</div>}
        {rows.map((t) => (
          <div key={t.id}>
            <div className="tx">
              <div className="icon">{t.type === 'income' ? '＋' : t.categories?.icon || '🧾'}</div>
              <div className="grow">
                <div className="name">{t.merchants?.canonical_name || '未設定'}</div>
                <div className="sub">
                  {t.categories?.name || '未分類'} ・ {formatDate(t.date)}
                </div>
              </div>
              <div className="amount" style={{ color: t.type === 'income' ? 'var(--green)' : 'inherit' }}>
                {t.type === 'income' ? '+' : '-'}
                {yen(t.amount)}
              </div>
            </div>
            <button
              onClick={() => handleDelete(t.id)}
              style={{ background: 'none', color: 'var(--muted)', fontSize: 11, margin: '-3px 0 7px 49px' }}
            >
              削除
            </button>
          </div>
        ))}
      </section>
    </>
  )
}