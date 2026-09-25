import GmailConnectionCard from '../features/gmail/GmailConnectionCard'

interface Props {
  userId: string
  userEmail: string | undefined
  onSignOut: () => void
  onOpenImport: () => void
}

export default function More({ userId, userEmail, onSignOut, onOpenImport }: Props) {
  return (
    <>
      <div className="section-head">
        <h2>その他</h2>
      </div>

      <section className="card">
        <div className="spend-row">
          <div className="icon">🎯</div>
          <div className="grow">
            <div className="name">予算設定</div>
            <div className="sub">カテゴリーごとの予算を管理</div>
          </div>
          <span>›</span>
        </div>
        <button className="spend-row" style={{ width: '100%', textAlign: 'left', background: 'none' }} onClick={onOpenImport}>
          <div className="icon">📥</div>
          <div className="grow">
            <div className="name">インポート</div>
            <div className="sub">CSV・スクショから取り込み</div>
          </div>
          <span>›</span>
        </button>
      </section>

      <GmailConnectionCard userId={userId} />

      <section className="card">
        <div className="section-head">
          <h2>アカウント</h2>
        </div>
        <p className="sub" style={{ lineHeight: 1.8, marginBottom: 12 }}>
          {userEmail}としてログイン中です。
        </p>
        <button className="secondary" onClick={onSignOut}>
          ログアウト
        </button>
      </section>
    </>
  )
}
