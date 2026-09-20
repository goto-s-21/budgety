interface Props {
  userEmail: string | undefined
  onSignOut: () => void
}

export default function More({ userEmail, onSignOut }: Props) {
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
        <div className="spend-row">
          <div className="icon">📥</div>
          <div className="grow">
            <div className="name">CSV / PDFインポート</div>
            <div className="sub">次の実装フェーズで対応</div>
          </div>
          <span>›</span>
        </div>
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