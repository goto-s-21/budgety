// src/features/gmail/GmailConnectionCard.tsx
// More画面に置くGmail連携状態カード。
// 未連携なら「連携する」ボタン、連携済みなら状態と最終同期日時を表示する。

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { startGmailConnection } from './gmailAuth'

interface Props {
  userId: string
}

interface ConnectionInfo {
  status: 'active' | 'expired' | 'revoked'
  connected_at: string
  last_synced_at: string | null
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function GmailConnectionCard({ userId }: Props) {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadConnection() {
    setLoading(true)
    const { data } = await supabase
      .from('gmail_connections')
      .select('status, connected_at, last_synced_at')
      .eq('user_id', userId)
      .maybeSingle()
    setConnection(data as ConnectionInfo | null)
    setLoading(false)
  }

  useEffect(() => {
    loadConnection()

    // OAuthコールバック後にfrontendUrlへ ?gmail_connect=success/error で
    // リダイレカトされてくるため、そのクエリを見て結果を表示する。
    const params = new URLSearchParams(window.location.search)
    const result = params.get('gmail_connect')
    if (result === 'success') {
      setNotice('Gmail連携が完了しました。')
    } else if (result === 'error') {
      setNotice('Gmail連携に失敗しました。もう一度お試しください。')
    }
    if (result) {
      params.delete('gmail_connect')
      params.delete('reason')
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  function handleConnect() {
    startGmailConnection(userId)
  }

  const isActive = connection?.status === 'active'

  return (
    <section className="card">
      <div className="section-head">
        <h2>Gmail連携</h2>
      </div>

      {notice && (
        <div className="insight" style={{ marginBottom: 12 }}>
          <p>{notice}</p>
        </div>
      )}

      {loading && <p className="sub">読み込み中...</p>}

      {!loading && !connection && (
        <>
          <p className="sub" style={{ marginBottom: 12 }}>
            Gmailに届く支払い通知メール（三井住友カード・楽天ペイ・PayPayカードなど）を
            毎日自動で取り込みます。読み取り専用の権限のみを要求します。
          </p>
          <button className="primary" onClick={handleConnect}>
            Gmailと連携する
          </button>
        </>
      )}

      {!loading && connection && isActive && (
        <>
          <p className="sub">連携済み</p>
          <p className="sub">
            連携日：{formatDateTime(connection.connected_at)}
          </p>
          <p className="sub">
            最終同期：
            {connection.last_synced_at ? formatDateTime(connection.last_synced_at) : '未実行'}
          </p>
        </>
      )}

      {!loading && connection && !isActive && (
        <>
          <p className="sub" style={{ color: 'var(--primary)' }}>
            連携が無効になっています（{connection.status === 'expired' ? '再認証が必要です' : '解除済みです'}）。
          </p>
          <button className="primary" onClick={handleConnect}>
            再連携する
          </button>
        </>
      )}
    </section>
  )
}
