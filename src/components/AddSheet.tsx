import { useState } from 'react'
import type { FormEvent } from 'react'

export interface CategoryOption {
  id: string
  name: string
  icon: string | null
}

interface Props {
  open: boolean
  categories: CategoryOption[]
  onClose: () => void
  onSubmit: (input: {
    type: 'expense' | 'income'
    amount: number
    merchantName: string
    categoryId: string
    date: string
    memo?: string
  }) => Promise<void>
}

export default function AddSheet({ open, categories, onClose, onSubmit }: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!categoryId) return
    setSaving(true)
    try {
      await onSubmit({
        type,
        amount: Number(amount),
        merchantName: merchant,
        categoryId,
        date,
        memo: memo || undefined,
      })
      setAmount('')
      setMerchant('')
      setMemo('')
      setCategoryId('')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-head">
          <h2>記録を追加</h2>
          <button className="close" onClick={onClose} type="button">×</button>
        </div>

        <div className="type-switch">
          <button
            type="button"
            className={type === 'expense' ? 'selected' : ''}
            onClick={() => setType('expense')}
          >
            支出
          </button>
          <button
            type="button"
            className={type === 'income' ? 'selected' : ''}
            onClick={() => setType('income')}
          >
            収入
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label>金額</label>
          <input
            type="number"
            min={1}
            required
            placeholder="例：850"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <label>{type === 'expense' ? '利用先' : '収入元'}</label>
          <input
            required
            placeholder={type === 'expense' ? '例：セブンイレブン' : '例：アルバイト'}
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />

          <label>カテゴリー</label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">選択してください</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>

          <label>日付</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <label>メモ</label>
          <input
            placeholder="任意"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />

          <button className="primary" type="submit" disabled={saving}>
            {saving ? '保存中...' : '保存する'}
          </button>
        </form>
      </div>
    </div>
  )
}