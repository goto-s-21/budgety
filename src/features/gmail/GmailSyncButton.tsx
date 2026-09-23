import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { runGmailSync } from './runGmailSync'
import {
  fetchLatestGmailImportHistory,
  type GmailImportHistory,
} from './gmailHistory'

function formatDate(value: string) {
  return new Date(value).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function GmailSyncButton() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [history, setHistory] = useState<GmailImportHistory | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const latest = await fetchLatestGmailImportHistory(data.user.id)
      if (!cancelled) setHistory(latest)
    }).catch(console.error)

    return () => {
      cancelled = true
    }
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

        if (
          latest &&
          latest.id !== previous?.id &&
          new Date(latest.created_at).getTime() >= startedAt
        ) {
          setHistory(latest)
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

  return (
    <section className="card">
      <div className="section-head">
        <h2>Gmail同期</h2>
      </div>
      <p className="sub">Gmailの利用通知をGitHub Actionsで取り込みます。</p>
      <button className="primary" onClick={handleRun} disabled={running}>
        {running ? 'Gmailを更新中...' : 'Gmailを更新'}
      </button>
      {message && <p className="sub" style={{ marginTop: 12 }}>{message}</p>}
      {history && (
        <div className="sub" style={{ marginTop: 12 }}>
          <div>最終実行：{formatDate(history.created_at)}</div>
          <div style={{ marginTop: 4 }}>
            登録 {history.imported_count}　重複 {history.duplicate_count}　失敗 {history.failed_count}
          </div>
        </div>
      )}
    </section>
  )
}
