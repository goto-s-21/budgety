import { useState } from 'react'
import { yen, formatDate } from '../lib/formatters'
import { CategoryIcon, IconIncome, IconPencil } from '../components/Icons'

interface TxRow {
  id: string
  type: 'expense' | 'income'
  amount: number
  date: string
  memo: string | null
  category_id: string | null
  merchants: { canonical_name: string } | null
  categories: { name: string; icon: string | null } | null
}

interface Props {
  transactions: TxRow[]
  onAdd: () => void
  onEdit: (tx: TxRow) => void
}

type Filter = 'all' | 'expense' | 'income'

export default function History({ transactions, onAdd, onEdit }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const rows = transactions.filter((t) => filter === 'all' || t.type === filter)

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
          <button
            key={t.id}
            className="tx tx-editable"
            onClick={() => onEdit(t)}
            type="button"
          >
            <div className="icon">
              {t.type === 'income' ? (
                <IconIncome color="var(--primary)" />
              ) : (
                <CategoryIcon name={t.categories?.name || '未分類'} color="var(--primary)" />
              )}
            </div>
            <div className="grow">
              <div className="name">{t.merchants?.canonical_name || '未設定'}</div>
              <div className="sub">
                {t.categories?.name || '未分類'} ・ {formatDate(t.date)}
              </div>
            </div>
            <span className="edit-pencil" aria-hidden="true">
              <IconPencil color="var(--muted)" />
            </span>
            <div className="amount" style={{ color: t.type === 'income' ? 'var(--green)' : 'inherit' }}>
              {t.type === 'income' ? '+' : '-'}
              {yen(t.amount)}
            </div>
          </button>
        ))}
      </section>
    </>
  )
}