import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { runGmailSync } from './runGmailSync'
import {
  fetchGmailSyncItems,
  fetchLatestGmailImportHistory,
  type GmailImportHistory,
  type GmailSyncItem,
} from './gmailHistory'

function formatDate(value: string) {
  return new Date(value).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatAmount(value: number | null) {
  return value === null ? '-' : `¥${value.toLocaleString('ja-JP')}`
}

function itemLabel(item: GmailSyncItem) {
  const merchant = item.merchant_name || item.message_subject || item.message_from || '内容不明'
  const date = item.transaction_date || ''
  return `${date ? `${date} ` : ''}${merchant} ${formatAmount(item.amount)}`
}

export default function GmailSyncButton() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [history, setHistory] = useState<GmailImportHistory | null>(null)
  const [items, setItems] = useState<GmailSyncItem[]>([])
  const [expanded, setExpanded] = useState(false)

  async function loadLatest() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const latest = await fetchLatestGmailImportHistory(data.user.id)
    setHistory(latest)
    setItems(latest ? await fetchGmailSyncItems(latest.id) : [])
  }

  useEffect(() => {
    loadLatest().catch(console.error)
  }, [])

  async function handleRun() {
    if (running) return
    setRunning(true)
    setMessage('Gmailの取り込み処理を開始しています...')
    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) throw new Error('ログインが必要です')
      const previous = await fetchLatestGmailImportHistory(data.user.id)
      const startedAt = Date.now()
      await runGmailSync()
      setMessage('Gmailの取り込み処理を実行中です...')
      for (let i = 0; i < 12; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000))
        const latest = await fetchLatestGmailImportHistory(data.user.id)
        if (latest && latest.id !== previous?.id && new Date(latest.created_at).getTime() >= startedAt) {
          setHistory(latest)
          setItems(await fetchGmailSyncItems(latest.id))
          setMessage('Gmailの取り込みが完了しました。')
          return
        }
      }
      setMessage('Gmailの取り込みを開始しました。完了結果は後ほど表示されます。')
    } catch (error) {
      console.error(error)
      setMessage('Gmailの取り込み処理の起動に失敗しました。')
    } finally {
      setRunning(false)
    }
  }

  const grouped = {
    imported: items.filter((item) => item.result === 'imported'),
    duplicate: items.filter((item) => item.result === 'duplicate'),
    failed: items.filter((item) => item.result === 'failed'),
  }

  return (
    <section className="card">
      <div className="section-head"><h2>Gmail同期</h2></div>
      <p className="sub">Gmailの利用通知をGitHub Actionsで取り込みます。</p>
      <button className="primary" onClick={handleRun} disabled={running}>{running ? 'Gmailを更新中...' : 'Gmailを更新'}</button>
      {message && <p className="sub" style={{ marginTop: 12 }}>{message}</p>}
      {history && (
        <div className="sub" style={{ marginTop: 12 }}>
          <div>最終実行：{formatDate(history.created_at)}</div>
          <div style={{ marginTop: 4 }}>登録 {history.imported_count}　重複 {history.duplicate_count}　失敗 {history.failed_count}</div>
          <button className="text-button" type="button" onClick={() => setExpanded((value) => !value)} style={{ marginTop: 8 }}>{expanded ? '詳細を隠す' : '詳細を見る'}</button>
          {expanded && (
            <div style={{ marginTop: 12 }}>
              {items.length === 0 ? (
                <div>この実行では詳細データが保存されていません。</div>
              ) : (
                (['imported', 'duplicate', 'failed'] as const).map((result) => (
                  <div key={result} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600 }}>{result === 'imported' ? '登録' : result === 'duplicate' ? '重複' : '失敗'}</div>
                    {grouped[result].length === 0 ? <div>該当なし</div> : grouped[result].map((item) => (
                      <div key={item.id} style={{ marginTop: 4 }}>
                        <div>{itemLabel(item)}</div>
                        {result === 'failed' && item.error_message && <div style={{ color: 'var(--muted)' }}>{item.error_message}</div>}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
