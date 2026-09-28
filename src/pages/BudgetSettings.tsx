import { useState } from 'react'
import { upsertBudget } from '../lib/budgets'
import type { Budget } from '../lib/budgets'

interface Category {
  id: string
  name: string
  icon: string | null
}

interface Props {
  userId: string
  categories: Category[]
  budgets: Budget[]
  onBack: () => void
  onChange: (updated: Budget[]) => void
}

export default function BudgetSettings({ userId, categories, budgets, onBack, onChange }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    budgets.forEach((b) => { map[b.category_id] = String(b.amount) })
    return map
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  async function handleBlur(catId: string) {
    const amount = parseInt((amounts[catId] || '0').replace(/,/g, ''), 10) || 0
    setSaving((s) => ({ ...s, [catId]: true }))
    try {
      await upsertBudget(userId, catId, amount)
      const existing = budgets.find((b) => b.category_id === catId)
      const rest = budgets.filter((b) => b.category_id !== catId)
      const next = amount > 0 ? [...rest, { id: existing?.id || '', category_id: catId, amount }] : rest
      onChange(next)
    } finally {
      setSaving((s) => ({ ...s, [catId]: false }))
    }
  }

  const cats = categories.filter((c) => c.name !== '未分類')

  return (
    <>
      <div className="section-head" style={{ marginBottom: 4 }}>
        <button onClick={onBack} style={{ color: 'var(--primary)', fontSize: 15, padding: 0 }}>‹ 戻る</button>
        <h2 style={{ margin: 0 }}>予算設定</h2>
        <div style={{ width: 48 }} />
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>
        月ごとの予算をカテゴリー別に設定します。
      </p>
      <section className="card">
        {cats.map((cat, i) => (
          <div
            key={cat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 0',
              borderBottom: i < cats.length - 1 ? '1px solid #faedf1' : 'none',
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="name">{cat.icon ? `${cat.icon} ` : ''}{cat.name}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>¥</span>
              <input
                type="number"
                inputMode="numeric"
                value={amounts[cat.id] ?? ''}
                placeholder="0"
                onChange={(e) => setAmounts((a) => ({ ...a, [cat.id]: e.target.value }))}
                onBlur={() => handleBlur(cat.id)}
                style={{
                  width: 90,
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  textAlign: 'right',
                  fontSize: 14,
                  color: 'var(--text)',
                  background: saving[cat.id] ? '#fff3f6' : '#fff',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
