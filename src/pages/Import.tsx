import { categorizeWithAI } from '../lib/csv/categorizeWithAI'
import { useState } from 'react'
import { parseCsvFile } from '../lib/csv/parseCsv'
import { guessColumnMapping, isMappingComplete, FIELD_LABELS } from '../lib/csv/columnMapper'
import type { ColumnMapping, FieldKey } from '../lib/csv/columnMapper'
import { buildStagedRows, markDuplicates, commitStagedRows } from '../lib/csv/importTransactions'
import type { StagedRow, ImportResult } from '../lib/csv/importTransactions'
import { yen } from '../lib/formatters'

interface Props {
  userId: string
  categories: { id: string; name: string }[]
  onDone: () => void
  onBack: () => void
}

type Step = 'select' | 'mapping' | 'preview' | 'done'

export default function Import({ userId, categories, onDone, onBack }: Props) {
  const [step, setStep] = useState<Step>('select')
  const [filename, setFilename] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [staged, setStaged] = useState<StagedRow[]>([])
  const [defaultCategoryId, setDefaultCategoryId] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [categoryMap, setCategoryMap] = useState<Record<number, string>>({})

  const uncategorized = categories.find((c) => c.name === '未分類')

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setFilename(file.name)
    try {
      const parsed = await parseCsvFile(file)
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError('このCSVの形式を自動判定できませんでした。列を指定してください。')
        return
      }
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setMapping(guessColumnMapping(parsed.headers))
      setStep('mapping')
    } catch {
      setError('このCSVの形式を自動判定できませんでした。列を指定してください。')
    }
  }

  function handleMappingChange(field: FieldKey, header: string) {
    setMapping((m) => ({ ...m, [field]: header || undefined }))
  }

  async function handleBuildPreview() {
    setBusy(true)
    setError('')
    try {
      const built = buildStagedRows(rows, mapping)
      const withDuplicates = await markDuplicates(userId, built)
      setStaged(withDuplicates)
      setDefaultCategoryId(uncategorized?.id || categories[0]?.id || '')
      setStep('preview')
    } catch {
      setError('重複確認中にエラーが発生しました。')
    } finally {
      setBusy(false)
    }
  }

  async function handleCommit() {
  if (!defaultCategoryId) return
  setBusy(true)
  try {
    const res = await commitStagedRows(
      userId,
      staged,
      defaultCategoryId,
      serviceName || 'unknown',
      filename,
      categoryMap
    )
    setResult(res)
    setStep('done')
  } catch {
    setError('登録中にエラーが発生しました。')
  } finally {
    setBusy(false)
  }
}

  async function handleAICategorize() {
    const items = staged
      .map((r) => ({
        index: r.rowIndex,
        merchant: r.merchantName || '',
        amount: r.amount ?? 0,
      }))

    setIsCategorizing(true)
    setError('')
    try {
      const results = await categorizeWithAI(items)
      const nextMap: Record<number, string> = {}
      for (const result of results) {
        const category = categories.find((c) => c.name === result.category)
        if (category) nextMap[result.index] = category.id
      }
      setCategoryMap((current) => ({ ...current, ...nextMap }))
    } catch {
      setError('AIカテゴリー判定に失敗しました。')
    } finally {
      setIsCategorizing(false)
    }
  }

  const okCount = staged.filter((r) => r.status === 'ok').length
  const reviewCount = staged.filter((r) => r.status === 'needs_review').length
  const dupCount = staged.filter((r) => r.status === 'duplicate').length

  return (
    <>
      <div className="section-head">
        <h2>CSVインポート</h2>
        <button onClick={onBack}>戻る</button>
      </div>

      {error && (
        <section className="card">
          <div className="insight" style={{ borderColor: 'var(--primary)' }}>
            <p style={{ color: 'var(--dark)' }}>{error}</p>
          </div>
        </section>
      )}

      {step === 'select' && (
        <section className="card">
          <p className="sub" style={{ lineHeight: 1.8, marginBottom: 14 }}>
            楽天カード、PayPayなど、各サービスからダウンロードしたCSVファイルを選択してください。
            列の並びが異なるCSVでも、次の画面で確認・修正できます。
          </p>
          <label>サービス名（任意）</label>
          <input
            className="form"
            style={{ marginBottom: 12 }}
            placeholder="例：楽天カード"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
          />
          <input type="file" accept=".csv" onChange={handleFileSelect} />
        </section>
      )}

      {step === 'mapping' && (
        <section className="card">
          <p className="sub" style={{ marginBottom: 14 }}>
            読み込み件数：{rows.length}件。各項目に対応するCSVの列を確認してください。
          </p>
          {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => (
            <div key={field} style={{ marginBottom: 10 }}>
              <label>
                {FIELD_LABELS[field]}
                {(field === 'date' || field === 'amount' || field === 'merchant') && ' (必須)'}
              </label>
              <select
                value={mapping[field] || ''}
                onChange={(e) => handleMappingChange(field, e.target.value)}
              >
                <option value="">未選択</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            className="primary"
            disabled={!isMappingComplete(mapping) || busy}
            onClick={handleBuildPreview}
          >
            {busy ? '確認中...' : 'プレビューを表示'}
          </button>
        </section>
      )}

      {step === 'preview' && (
        <>
          <section className="card">
            <div className="insight">
              <strong>読み込み結果</strong>
              <p>
                登録可能：{okCount}件 ・ 確認が必要：{reviewCount}件 ・ 重複の可能性：{dupCount}件
              </p>
            </div>
            <label>未分類データのカテゴリー</label>
            <button
  className="secondary"
  disabled={isCategorizing || busy}
  onClick={handleAICategorize}
  style={{ marginTop: 10 }}
>
  {isCategorizing ? 'AI判定中...' : 'AIでカテゴリーを自動判定する'}
</button>
            <select value={defaultCategoryId} onChange={(e) => setDefaultCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </section>

          <section className="card">
            {staged.slice(0, 20).map((r) => (
              <div className="tx" key={r.rowIndex}>
  <div className="grow">
    <div className="name">{r.merchantName || '(店舗不明)'}</div>
    <div className="sub">
      {r.date || '(日付不明)'} ・{' '}
      {r.status === 'duplicate'
        ? '重複の可能性があります'
        : r.status === 'needs_review'
          ? '確認が必要です'
          : '登録されます'}
    </div>
    <select
      value={categoryMap[r.rowIndex] || defaultCategoryId}
      onChange={(e) =>
        setCategoryMap((m) => ({ ...m, [r.rowIndex]: e.target.value }))
      }
      style={{ marginTop: 6 }}
    >
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  </div>
  <div className="amount">{r.amount !== null ? yen(r.amount) : '?'}</div>
</div>
            ))}
            {staged.length > 20 && (
              <p className="sub" style={{ marginTop: 10 }}>
                他 {staged.length - 20} 件
              </p>
            )}
          </section>

          <button className="primary" disabled={busy} onClick={handleCommit}>
            {busy ? '登録中...' : `${okCount + reviewCount}件を登録する`}
          </button>
          <button className="secondary" onClick={() => setStep('mapping')}>
            列の対応をやり直す
          </button>
        </>
      )}

      {step === 'done' && result && (
        <section className="card">
          <div className="insight">
            <strong>インポートが完了しました</strong>
            <p>
              登録：{result.importedCount}件 ・ 重複スキップ：{result.duplicateCount}件 ・
              失敗：{result.failedCount}件
            </p>
          </div>
          <button className="primary" onClick={onDone}>
            履歴を確認する
          </button>
        </section>
      )}
    </>
  )
}
