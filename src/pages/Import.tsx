import { categorizeWithAI } from '../lib/csv/categorizeWithAI'
import { useState, useEffect } from 'react'
import { parseCsvFile } from '../lib/csv/parseCsv'
import { guessColumnMapping, isMappingComplete, FIELD_LABELS } from '../lib/csv/columnMapper'
import type { ColumnMapping, FieldKey } from '../lib/csv/columnMapper'
import {
  buildStagedRows,
  buildStagedRowsFromExtracted,
  markDuplicates,
  commitStagedRows,
  fetchImportHistory,
  fetchImportedTransactions,
} from '../lib/csv/importTransactions'
import { extractTransactionsFromImage } from '../lib/screenshot/parseScreenshot'
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
  const [mode, setMode] = useState<'csv' | 'screenshot'>('csv')
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
  const [dupDecisions, setDupDecisions] = useState<Record<number, 'skip' | 'register'>>({})
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
    setMode('csv')
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


  async function handleScreenshotSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    setMode('screenshot')
    setFilename(file.name)
    try {
      const extracted = await extractTransactionsFromImage(file)
      if (extracted.length === 0) {
        setError('スクリーンショットから取引を読み取れませんでした。別の画像でお試しください。')
        return
      }
      const built = buildStagedRowsFromExtracted(extracted)
      const withDuplicates = await markDuplicates(userId, built)
      setStaged(withDuplicates)
      setDupDecisions({})
      setDefaultCategoryId(uncategorized?.id || categories[0]?.id || '')
      setServiceName((s) => s || 'スクリーンショット')
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'スクリーンショットの読み取りに失敗しました。')
    } finally {
      setBusy(false)
      e.target.value = '' // 同じ画像を再選択できるようにする
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
      setDupDecisions({})
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
        categoryMap,
        dupDecisions
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
    setDupDecisions({})
    setMode('csv')
    setStep('select')
  }


  const okCount = staged.filter((r) => r.status === 'ok').length
  const reviewCount = staged.filter((r) => r.status === 'needs_review').length
  const dupCount = staged.filter((r) => r.status === 'duplicate').length
  const possibleDupCount = staged.filter((r) => r.status === 'possible_duplicate').length
  const dupRegisterCount = staged.filter(
    (r) =>
      (r.status === 'duplicate' || r.status === 'possible_duplicate') &&
      dupDecisions[r.rowIndex] === 'register'
  ).length
  const registerCount = okCount + reviewCount + dupRegisterCount


  return (
    <>
      <div className="section-head">
        <h2>インポート</h2>
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
            <h2 style={{ marginTop: 0 }}>CSVから取り込む</h2>
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
            <h2 style={{ marginTop: 0 }}>スクショから取り込む</h2>
            <p className="sub" style={{ lineHeight: 1.8, marginBottom: 14 }}>
              決済アプリ・銀行アプリ・カード明細・レシートなどのスクリーンショットを選ぶと、
              AIが日付・金額・店舗を読み取ります。次の画面で内容を確認・修正してから登録できます。
              重複はCSVと同じく自動でスキップされます。
            </p>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={handleScreenshotSelect}
            />
            {busy && mode === 'screenshot' && (
              <p className="sub" style={{ marginTop: 10 }}>画像を読み取っています...</p>
            )}
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
                登録可能：{okCount}件 ・ 確認が必要：{reviewCount}件 ・ 重複：{dupCount}件 ・
                似た取引：{possibleDupCount}件
              </p>
              {(dupCount > 0 || possibleDupCount > 0) && (
                <p style={{ marginTop: 6 }}>
                  既存と重複・似ている取引は既定でスキップします。登録したい場合は各行の
                  「重複でも登録する」にチェックしてください。
                </p>
              )}
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
            {staged.map((r) => {
              const isDupLike = r.status === 'duplicate' || r.status === 'possible_duplicate'
              const willRegister = !isDupLike || dupDecisions[r.rowIndex] === 'register'
              return (
                <div
                  className="tx"
                  key={r.rowIndex}
                  style={isDupLike && !willRegister ? { opacity: 0.55 } : undefined}
                >
                  <div className="grow">
                    <div className="name">{r.merchantName || '(店舗不明)'}</div>
                    <div className="sub">
                      {r.date || '(日付不明)'} ・{' '}
                      {r.status === 'duplicate'
                        ? '同じ取引が既に登録済み'
                        : r.status === 'possible_duplicate'
                          ? '似た取引が既にあります'
                          : r.status === 'needs_review'
                            ? '確認が必要です'
                            : '登録されます'}
                    </div>
                    {isDupLike && r.existingMatch && (
                      <div className="sub" style={{ color: 'var(--primary)' }}>
                        既存：{r.existingMatch.merchantName || '(店舗不明)'}（{r.existingMatch.date}
                        {' ・ '}
                        {yen(r.existingMatch.amount)}）
                      </div>
                    )}
                    {isDupLike && (
                      <label
                        className="sub"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}
                      >
                        <input
                          type="checkbox"
                          checked={willRegister}
                          onChange={(e) =>
                            setDupDecisions((m) => ({
                              ...m,
                              [r.rowIndex]: e.target.checked ? 'register' : 'skip',
                            }))
                          }
                        />
                        重複でも登録する
                      </label>
                    )}
                    {willRegister && (
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
                    )}
                  </div>
                  <div className="amount">{r.amount !== null ? yen(r.amount) : '?'}</div>
                </div>
              )
            })}
          </section>


          <button className="primary" disabled={busy} onClick={handleCommit}>
            {busy ? '登録中...' : `${registerCount}件を登録する`}
          </button>
          {mode === 'csv' ? (
            <button className="secondary" onClick={() => setStep('mapping')}>
              列の対応をやり直す
            </button>
          ) : (
            <button className="secondary" onClick={handleImportAgain}>
              別のスクショを選ぶ
            </button>
          )}
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
            続けて取り込む
          </button>
        </section>
      )}
    </>
  )
}