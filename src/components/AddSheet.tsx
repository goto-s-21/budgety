import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'

export interface CategoryOption {
  id: string
  name: string
  icon: string | null
}

export interface EditableTransaction {
  id: string
  type: 'expense' | 'income'
  amount: number
  merchantName: string
  categoryId: string
  date: string
  memo?: string | null
}

interface Props {
  open: boolean
  categories: CategoryOption[]
  editing?: EditableTransaction | null
  onClose: () => void
  onSubmit: (input: {
    type: 'expense' | 'income'
    amount: number
    merchantName: string
    categoryId: string
    date: string
    memo?: string
  }) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

const emptyForm = {
  type: 'expense' as 'expense' | 'income',
  amount: '',
  merchant: '',
  categoryId: '',
  date: new Date().toISOString().slice(0, 10),
  memo: '',
}

export default function AddSheet({ open, categories, editing, onClose, onSubmit, onDelete }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(editing)

  useEffect(() => {
    if (open && editing) {
      setForm({
        type: editing.type,
        amount: String(editing.amount),
        merchant: editing.merchantName,
        categoryId: editing.categoryId,
        date: editing.date,
        memo: editing.memo || '',
      })
    } else if (open && !editing) {
      setForm(emptyForm)
    }
  }, [open, editing])

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.type === 'expense' && !form.categoryId) return
    setSaving(true)
    try {
      await onSubmit({
        type: form.type,
        amount: Number(form.amount),
        merchantName: form.merchant,
        categoryId: form.categoryId,
        date: form.date,
        memo: form.memo || undefined,
      })
      setForm(emptyForm)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing || !onDelete) return
    if (!confirm('この記録を削除しますか？')) return
    setSaving(true)
    try {
      await onDelete(editing.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-head">
          <h2>{isEditing ? '記録を編集' : '記録を追加'}</h2>
          <button className="close" onClick={onClose} type="button">×</button>
        </div>

        <div className="type-switch">
          <button
            type="button"
            className={form.type === 'expense' ? 'selected' : ''}
            onClick={() => setForm((f) => ({ ...f, type: 'expense', categoryId: '' }))}
          >
            支出
          </button>
          <button
            type="button"
            className={form.type === 'income' ? 'selected' : ''}
            onClick={() => setForm((f) => ({ ...f, type: 'income', categoryId: '' }))}
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
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />

          <label>{form.type === 'expense' ? '利用先' : '収入元'}</label>
          <input
            required
            placeholder={form.type === 'expense' ? '例：セブンイレブン' : '例：アルバイト'}
            value={form.merchant}
            onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
          />

          {form.type === 'expense' && (
            <>
              <label>カテゴリー</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">選択してください</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <label>日付</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />

          <label>メモ</label>
          <input
            placeholder="任意"
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
          />

          <button className="primary" type="submit" disabled={saving}>
            {saving ? '保存中...' : isEditing ? '更新する' : '保存する'}
          </button>

          {isEditing && onDelete && (
            <button
              className="secondary"
              type="button"
              onClick={handleDelete}
              disabled={saving}
              style={{ color: 'var(--primary)' }}
            >
              この記録を削除する
            </button>
          )}
        </form>
      </div>
    </div>
  )
}