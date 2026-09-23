import { useState } from 'react'
import { runGmailSync } from './runGmailSync'

export default function GmailSyncButton() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleRun() {
    if (running) return

    setRunning(true)
    setMessage(null)

    try {
      await runGmailSync()
      setMessage('Gmail同期を開始しました。完了後に右上の更新ボタンを押してください。')
    } catch (error) {
      console.error(error)
      setMessage('Gmail同期の起動に失敗しました。')
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
        {running ? 'Gmail同期を起動中...' : 'Gmailを今すぐ同期'}
      </button>
      {message && <p className="sub" style={{ marginTop: 12 }}>{message}</p>}
    </section>
  )
}
