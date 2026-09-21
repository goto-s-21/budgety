import { categorizeWithAI } from '../lib/csv/categorizeWithAI'
import { useState, useEffect } from 'react'
import { parseCsvFile } from '../lib/csv/parseCsv'
import { guessColumnMapping, isMappingComplete, FIELD_LABELS } from '../lib/csv/columnMapper'
import type { ColumnMapping, FieldKey } from '../lib/csv/columnMapper'
import {
  buildStagedRows,
  markDuplicates,
  commitStagedRows,
  fetchImportHistory,
  fetchImportedTransactions,
} from '../lib/csv/importTransactions'
import type {
  StagedRow,
  ImportResult,
  ImportHistoryRow,
  ImportedTransactionRow,
} from '../lib/csv/importTransactions'
import { yen } from '../lib/formatters'


interface Props {
  userId: string
  categories: { id: string; name: string }[]
  onDone: () => void
  onBack: () => void
}


type Step = 'select' | 'mapping' | 'preview' | 'done'


function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function sourceLabel(source: string): string {
  if (source === 'csv') return 'CSV'
  if (source === 'pdf') return 'PDF'
  if (source === 'gmail') return 'Gmail'
  return source
}


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
  const [history, setHistory] = useState<ImportHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Record<string, ImportedTransactionRow[]>>({})
  const [approxFlags, setApproxFlags] = useState<Record<string, boolean>>({})
  const [expandLoading, setExpandLoading] = useState<string | null>(null)


  const uncategorized = categories.find((c) => c.name === '未分類')


  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const data = await fetchImportHistory(userId)
      setHistory(data)
    } catch {
      // 履歴の取得に失敗しても取り込み自体は継続できるため、エラー表示は控える
    } finally {
      setHistoryLoading(false)
    }
  }


  useEffect(() => {
    loadHistory()
  }, [userId])


  async function handleToggleExpand(h: ImportHistoryRow) {
    if (expandedId === h.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(h.id)
    if (expandedRows[h.id]) return
    setExpandLoading(h.id)
    try {
      const { rows: txs, approximate } = await fetchImportedTransactions(userId, h)
      setExpandedRows((m) => ({ ...m, [h.id]: txs }))
      setApproxFlags((m) => ({ ...m, [h.id]: approximate }))
    } catch {
      setExpandedRows((m) => ({ ...m, [h.id]: [] }))
    } finally {
      setExpandLoading(null)
    }
  }


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
      setExpandedRows({})
      setApproxFlags({})
      setExpandedId(null)
      loadHistory()
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


  function handleImportAgain() {
    setFilename('')
    setHeaders([])
    setRows([])
    setMapping({})
    setStaged([])
    setServiceName('')
    setError('')
    setResult(null)
    setCategoryMap({})
    setStep('select')
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
        <>
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

          <section className="card">
            <div
              className="section-head"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowHistory((v) => !v)}
            >
              <h2>取り込み履歴</h2>
              <button>{showHistory ? '閉じる' : '表示する'}</button>
            </div>
            {showHistory && (
              <>
                {historyLoading && <p className="sub">読み込み中...</p>}
                {!historyLoading && history.length === 0 && (
                  <div className="empty">まだ取り込み履歴がありません。</div>
                )}
                {!historyLoading &&
                  history.map((h) => (
                    <div key={h.id}>
                      <div
                        className="tx"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleExpand(h)}
                      >
                        <div className="grow">
                          <div className="name">
                            {h.service_name || sourceLabel(h.source)}
                            <span className="sub" style={{ marginLeft: 6 }}>
                              {sourceLabel(h.source)}
                            </span>
                          </div>
                          <div className="sub">
                            {h.filename} ・ {formatDateTime(h.created_at)}
                          </div>
                          <div className="sub">
                            登録：{h.imported_count}件 ・ 重複：{h.duplicate_count}件 ・
                            失敗：{h.failed_count}件
                          </div>
                        </div>
                        <div className="amount">{expandedId === h.id ? '▲' : '▼'}</div>
                      </div>

                      {expandedId === h.id && (
                        <div style={{ paddingLeft: 12, marginBottom: 10 }}>
                          {expandLoading === h.id && <p className="sub">読み込み中...</p>}
                          {expandLoading !== h.id && approxFlags[h.id] && (
                            <p className="sub" style={{ color: 'var(--primary)' }}>
                              推定表示です（正確ではない可能性があります）
                            </p>
                          )}
                          {expandLoading !== h.id && (expandedRows[h.id]?.length || 0) === 0 && (
                            <div className="empty">この回で登録された取引はありません。</div>
                          )}
                          {expandLoading !== h.id &&
                            expandedRows[h.id]?.map((t) => (
                              <div className="tx" key={t.id}>
                                <div className="grow">
                                  <div className="name">
                                    {t.categories?.icon ? `${t.categories.icon} ` : ''}
                                    {t.merchants?.canonical_name || '(店舗不明)'}
                                  </div>
                                  <div className="sub">
                                    {t.date} ・ {t.categories?.name || '未分類'}
                                  </div>
                                </div>
                                <div className="amount">{yen(t.amount)}</div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}
          </section>
        </>
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
            <button
              className="secondary"
              disabled={isCategorizing || busy}
              onClick={handleAICategorize}
              style={{ marginTop: 10 }}
            >
              {isCategorizing ? 'AI判定中...' : 'AIでカテゴリーを自動判定する'}
            </button>
            <p className="sub" style={{ marginTop: 8 }}>
              各行のカテゴリーはAIが自動判定します。判定結果が違う場合は行ごとに変更できます。
            </p>
          </section>


          <section className="card">
            {staged.map((r) => (
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
          <button className="secondary" onClick={handleImportAgain}>
            続けて別のCSVを取り込む
          </button>
        </section>
      )}
    </>
  )
}