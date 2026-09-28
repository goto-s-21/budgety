import { useState, useEffect } from 'react'
import { upsertBudget } from '../lib/budgets'
import type { Budget } from '../lib/budgets'

function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${y}年${m}月`
}

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
  const [month, setMonth] = useState(thisMonth())
  const [localAmounts, setLocalAmounts] = useState<Record<string, string>>({})
  const [savingCat, setSavingCat] = useState<Record<string, boolean>>({})
  const [copying, setCopying] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const map: Record<string, string> = {}
    budgets.filter((b) => b.month === month).forEach((b) => {
      map[b.category_id] = String(b.amount)
    })
    setLocalAmounts(map)
  }, [month, budgets])

  async function handleBlur(catId: string) {
    const amount = parseInt((localAmounts[catId] || '0').replace(/,/g, ''), 10) || 0
    setSavingCat((s) => ({ ...s, [catId]: true }))
    setSaveError(null)
    try {
      await upsertBudget(userId, catId, month, amount)
      const rest = budgets.filter((b) => !(b.category_id === catId && b.month === month))
      const next: Budget[] = amount > 0
        ? [...rest, { id: '', category_id: catId, month: month, amount }]
        : rest
      onChange(next)
    } catch (e: any) {
      setSaveError(e?.message ?? e?.error_description ?? JSON.stringify(e))
    } finally {
      setSavingCat((s) => ({ ...s, [catId]: false }))
    }
  }

  async function handleCopyFromPrev() {
    const prev = shiftMonth(month, -1)
    const prevBudgets = budgets.filter((b) => b.month === prev)
    if (prevBudgets.length === 0) {
      alert(`${formatMonth(prev)}の予算が設定されていません`)
      return
    }
    setCopying(true)
    try {
      await Promise.all(prevBudgets.map((b) => upsertBudget(userId, b.category_id, month, b.amount)))
      const rest = budgets.filter((b) => b.month !== month)
      const existing = budgets.filter((b) => b.month === month)
      const copied = prevBudgets.map((b) => ({ ...b, month: month }))
      const merged = [
        ...existing.filter((e) => !copied.find((c) => c.category_id === e.category_id)),
        ...copied,
      ]
      onChange([...rest, ...merged])
    } finally {
      setCopying(false)
    }
  }

  const cats = categories.filter((c) => c.name !== '未分類')
  const total = cats.reduce((sum, cat) => {
    return sum + (parseInt((localAmounts[cat.id] || '0').replace(/,/g, ''), 10) || 0)
  }, 0)

  return (
    <>
      <div className="section-head" style={{ marginBottom: 4 }}>
        <button onClick={onBack} style={{ color: 'var(--primary)', fontSize: 15, padding: 0 }}>‹ 戻る</button>
        <h2 style={{ margin: 0 }}>予算設定</h2>
        <div style={{ width: 48 }} />
      </div>

      <section className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setMonth(shiftMonth(month, -1))} style={{ fontSize: 22, color: 'var(--primary)', padding: '4px 10px' }}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{formatMonth(month)}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))} style={{ fontSize: 22, color: 'var(--primary)', padding: '4px 10px' }}>›</button>
        </div>
      </section>

      {saveError && (
        <p style={{ color: '#e03e5a', fontSize: 13, margin: '0 0 8px', background: '#fff0f3', borderRadius: 8, padding: '8px 12px' }}>
          エラー: {saveError}
        </p>
      )}

      <button
        onClick={handleCopyFromPrev}
        disabled={copying}
        className="btn-secondary"
        style={{ marginBottom: 10 }}
      >
        {copying ? '引き継ぎ中...' : `${formatMonth(shiftMonth(month, -1))}の予算を引き継ぐ`}
      </button>

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
                value={localAmounts[cat.id] ?? ''}
                placeholder="0"
                onChange={(e) =>
                  setLocalAmounts((a) => ({ ...a, [cat.id]: e.target.value }))
                }
                onBlur={() => handleBlur(cat.id)}
                style={{
                  width: 90,
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  textAlign: 'right',
                  fontSize: 14,
                  color: 'var(--text)',
                  background: savingCat[cat.id] ? '#fff3f6' : '#fff',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>月間予算合計</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary)' }}>
            ¥{total.toLocaleString()}
          </span>
        </div>
      </section>
    </>
  )
}
