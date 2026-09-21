// supabase/functions/gmail-oauth-callback/index.ts
// Googleの同意画面から戻ってきた認可コードをrefresh_token/access_tokenに
// 交換し、gmail_connectionsに保存するSupabase Edge Function。
//
// デプロイ: supabase functions deploy gmail-oauth-callback
// 必要なSecrets(supabase secrets set で設定):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
//   FRONTEND_URL (連携完了後にリダイレカトするフロントエンドのURL)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

function decodeState(state: string): { userId: string; nonce: string } | null {
  try {
    const json = atob(state)
    const parsed = JSON.parse(json)
    if (typeof parsed.userId !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function getRedirectUri(supabaseUrl: string): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `https://${projectRef}.supabase.co/functions/v1/gmail-oauth-callback`
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  const frontendUrl = Deno.env.get('FRONTEND_URL') || '/'

  if (error) {
    return Response.redirect(`${frontendUrl}?gmail_connect=error&reason=${encodeURIComponent(error)}`, 302)
  }

  if (!code || !state) {
    return Response.redirect(`${frontendUrl}?gmail_connect=error&reason=missing_params`, 302)
  }

  const decoded = decodeState(state)
  if (!decoded) {
    return Response.redirect(`${frontendUrl}?gmail_connect=error&reason=invalid_state`, 302)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const redirectUri = getRedirectUri(supabaseUrl)

  // 認可コードをrefresh_token/access_tokenに交換する
  const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error('token exchange failed', body)
    return Response.redirect(`${frontendUrl}?gmail_connect=error&reason=token_exchange_failed`, 302)
  }

  const tokenData = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokenData

  if (!refresh_token) {
    // prompt=consentを指定していれば通常は発行されるが、念のためチェックする
    return Response.redirect(`${frontendUrl}?gmail_connect=error&reason=no_refresh_token`, 302)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  const { error: upsertError } = await supabase
    .from('gmail_connections')
    .upsert(
      {
        user_id: decoded.userId,
        refresh_token,
        access_token,
        token_expires_at: tokenExpiresAt,
        connected_at: new Date().toISOString(),
        status: 'active',
      },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error('failed to save gmail connection', upsertError)
    return Response.redirect(`${frontendUrl}?gmail_connect=error&reason=save_failed`, 302)
  }

  return Response.redirect(`${frontendUrl}?gmail_connect=success`, 302)
})
