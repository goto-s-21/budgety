interface Props {
  userEmail: string | undefined
  onSignOut: () => void
  onOpenImport: () => void
}

export default function More({ userEmail, onSignOut, onOpenImport }: Props) {
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
            <div className="name">CSVインポート</div>
            <div className="sub">過去データの取り込み</div>
          </div>
          <span>›</span>
        </button>
        <div className="spend-row">
          <div className="icon">✉️</div>
          <div className="grow">
            <div className="name">Gmail連携</div>
            <div className="sub">利用通知の自動取得（GitHub Actions経由）</div>
          </div>
          <span>›</span>
        </div>
      </section>

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
