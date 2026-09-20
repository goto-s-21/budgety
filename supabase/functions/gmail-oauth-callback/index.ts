// supabase/functions/gmail-oauth-callback/index.ts
//
// フロントから受け取った認可コード(code)をGoogleのトークンエンドポイントに渡し、
// refresh_token / access_token を取得してDBに保存するEdge Function。
//
// Client Secretはこの関数の環境変数(Supabase Secrets)にのみ置き、
// フロントエンドには絶対に渡さない。
//
// 環境変数(Supabase Dashboard > Edge Functions > Secrets で設定):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI      例: http://localhost:5173/auth/gmail/callback
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface RequestBody {
  code: string;
  userId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { code, userId }: RequestBody = await req.json();

    if (!code || !userId) {
      return new Response(
        JSON.stringify({ error: "code and userId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "server_misconfigured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // --- 1. 認可コード -> トークン交換 ---
    const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("Google token exchange failed:", errBody);
      return new Response(
        JSON.stringify({ error: "token_exchange_failed", detail: errBody }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const tokenData: TokenResponse = await tokenRes.json();

    // refresh_tokenが返らない場合、Google側でprompt=consentが効いていない
    // (前回同意済みでキャッシュされている等)。呼び出し元にエラーを返し、
    // フロント側で再度 prompt=consent 付きで認可URLへ誘導させる。
    if (!tokenData.refresh_token) {
      return new Response(
        JSON.stringify({
          error: "no_refresh_token",
          message:
            "refresh_tokenが取得できませんでした。再連携してください(prompt=consentが必要)。",
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    // --- 2. DBへ保存 ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const { error: dbError } = await supabase
      .from("gmail_connections")
      .upsert(
        {
          user_id: userId,
          refresh_token: tokenData.refresh_token,
          access_token: tokenData.access_token,
          token_expires_at: expiresAt.toISOString(),
          connected_at: new Date().toISOString(),
          status: "active",
        },
        { onConflict: "user_id" },
      );

    if (dbError) {
      console.error("DB upsert failed:", dbError);
      return new Response(
        JSON.stringify({ error: "db_save_failed", detail: dbError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, connectedAt: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
