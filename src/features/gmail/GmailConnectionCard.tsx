import GmailSyncButton from './GmailSyncButton'
import { startGmailConnection } from './gmailAuth'

interface Props {
  userId: string
}

export default function GmailConnectionCard({ userId }: Props) {
  return (
    <>
      <GmailSyncButton />
      <section className="card">
        <div className="section-head"><h2>Gmail連携</h2></div>
        <p className="sub">トークンが切れた場合や初回接続時はこちらから再接続してください。</p>
        <button className="btn-secondary" onClick={() => startGmailConnection(userId)}>
          Gmail を接続 / 再接続
        </button>
      </section>
    </>
  )
}
