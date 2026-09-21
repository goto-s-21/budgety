// src/features/gmail/gmailAuth.ts
// Gmail連携用のOAuth認可 URLを生成し、Google同意画面へ遷移させる。
// スコープはGmail読み取り専用(gmail.readonly)のみを要求する。

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

// Supabase Edge FunctionのコールバッハURL。
// Supabaseプロジェクトのfunctions/gmail-oauth-callbackを指す。
function getRedirectUri(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `https://${projectRef}.supabase.co/functions/v1/gmail-oauth-callback`
}

// stateにuser_idを埋め込み、コールバック側でどのユーザーの連携かを判別する。
// 簡易的な改ざん防止のため、ランダム値も付与する。
function buildState(userId: string): string {
  const nonce = Math.random().toString(36).slice(2)
  const payload = { userId, nonce }
  return btoa(JSON.stringify(payload))
}

export function startGmailConnection(userId: string): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
  const redirectUri = getRedirectUri()
  const state = buildState(userId)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_READONLY_SCOPE,
    access_type: 'offline', // refresh_tokenを取得するために必須
    prompt: 'consent', // 再連携時も必たrefresh_tokenを再発行させる
    state,
  })

  window.location.href = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`
}
