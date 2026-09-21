import { useState } from 'react'
import { yen, monthKey, thisMonth, formatPeriodLabel, navigatePeriod } from '../lib/formatters'
import { CategoryIcon } from '../components/Icons'

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
  totalAssets: number | null
  hasReset: boolean
  onSeeAnalysis: () => void
  onSeeHistory: () => void
  onAssetReset: (balance: number) => Promise<void>
  onAssetAdjust: (delta: number) => Promise<void>
}

type AssetModal = 'reset' | 'adjust' | null

export default function Home({ transactions, totalAssets, hasReset, onSeeAnalysis, onSeeHistory, onAssetReset, onAssetAdjust }: Props) {
  const [month, setMonth] = useState(thisMonth())
  const [assetModal, setAssetModal] = useState<AssetModal>(null)
  const [assetInput, setAssetInput] = useState('')
  const [saving, setSaving] = useState(false)

  const now = transactions.filter((t) => monthKey(t.date) === month)
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

  const recent = now.filter((t) => t.type === 'expense').slice(0, 3)

  function openModal(mode: AssetModal) {
    setAssetInput('')
    setAssetModal(mode)
  }

  async function handleAssetSubmit() {
    const val = parseFloat(assetInput.replace(/,/g, ''))
    if (isNaN(val)) return
    setSaving(true)
    try {
      if (assetModal === 'reset') {
        await onAssetReset(val)
      } else if (assetModal === 'adjust') {
        await onAssetAdjust(val)
      }
      setAssetModal(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* 総資産カード */}
      <section className="card asset-card">
        <div className="asset-header">
          <span className="asset-label">総資産（口座残高）</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasReset && (
              <button className="asset-action-btn" onClick={() => openModal('adjust')}>微調整</button>
            )}
            <button className="asset-action-btn" onClick={() => openModal('reset')}>
              {hasReset ? 'リセット' : '設定'}
            </button>
          </div>
        </div>
        {totalAssets !== null ? (
          <div className="asset-amount">{yen(totalAssets)}</div>
        ) : (
          <div className="asset-unset">残高を設定してください</div>
        )}
      </section>

      <section className="card">
        <div className="period-nav">
          <button className="pnav" onClick={() => setMonth(navigatePeriod('month', month, -1))}>‹</button>
          <span className="period-label">{formatPeriodLabel('month', month)}</span>
          <button className="pnav" onClick={() => setMonth(navigatePeriod('month', month, 1))}>›</button>
        </div>
      </section>

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
            <div className="icon">
              <CategoryIcon name={name} color="var(--primary)" />
            </div>
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
            <div className="icon">
              <CategoryIcon name={t.categories?.name || '未分類'} color="var(--primary)" />
            </div>
            <div className="grow">
              <div className="name">{t.merchants?.canonical_name || '未設定'}</div>
              <div className="sub">{t.categories?.name || '未分類'}</div>
            </div>
            <div className="amount">-{yen(t.amount)}</div>
          </div>
        ))}
      </section>

      {/* 総資産モーダル */}
      <div
        className={`modal ${assetModal ? 'open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setAssetModal(null) }}
      >
        <div className="sheet">
          <div className="sheet-head">
            <h2>
              {assetModal === 'reset'
                ? (hasReset ? '総資産をリセット' : '総資産を設定')
                : '微調整'}
            </h2>
            <button className="close" onClick={() => setAssetModal(null)}>✕</button>
          </div>

          {assetModal === 'reset' ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0' }}>
              現在の口座残高を入力してください。この時点から収支を追跡します。
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0' }}>
              総資産に加減算する金額を入力してください。<br />
              減らす場合はマイナスで入力（例：-3000）。
            </p>
          )}

          <div className="form">
            <label>{assetModal === 'reset' ? '口座残高（円）' : '調整額（円）'}</label>
            <input
              type="number"
              inputMode="numeric"
              value={assetInput}
              onChange={(e) => setAssetInput(e.target.value)}
              placeholder={assetModal === 'reset' ? '例: 500000' : '例: 3000 または -3000'}
              autoFocus
            />
          </div>

          <button
            className="primary"
            onClick={handleAssetSubmit}
            disabled={!assetInput || saving}
          >
            {saving ? '保存中…' : '保存する'}
          </button>
          <button className="secondary" onClick={() => setAssetModal(null)}>
            キャンセル
          </button>
        </div>
      </div>
    </>
  )
}
