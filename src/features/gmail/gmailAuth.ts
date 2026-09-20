// src/features/gmail/gmailAuth.ts
//
// Gmail連携の認可URL生成、コールバック処理、連携状態の取得・解除を行うユーティリティ。
// Googleログイン(Supabase Auth)とは完全に分離しており、
// ここはあくまで「Gmail読み取り許可」のためだけのモジュール。
//
// 既存の Supabase クライアントは src/lib/supabase.ts にあるためそこから import する。

import { supabase } from "../../lib/supabase";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// .env に定義する想定
// VITE_GOOGLE_CLIENT_ID=531950016771-m7fa46fultc6898n6nmc3srookjv5fpl.apps.googleusercontent.com
// VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/gmail/callback
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI as string;

export interface GmailConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  status: "active" | "expired" | "revoked" | null;
  daysUntilExpiry: number | null; // テストモードの7日制約を見越した残り日数
}

/**
 * Google OAuth同意画面へ遷移する。
 * access_type=offline: refresh_tokenを取得するために必須。
 * prompt=consent: 2回目以降もrefresh_tokenを再発行させるために必須。
 */
export function redirectToGoogleConsent() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

  window.location.href = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * /auth/gmail/callback で受け取った code を
 * Supabase Edge Function (gmail-oauth-callback) に渡してトークン交換させる。
 */
export async function handleGmailOAuthCallback(
  code: string,
  userId: string,
): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.functions.invoke(
    "gmail-oauth-callback",
    { body: { code, userId } },
  );

  if (error) {
    return { success: false, message: error.message };
  }

  if (data?.error === "no_refresh_token") {
    return {
      success: false,
      message: "再連携が必要です。もう一度連携を許可してください。",
    };
  }

  if (data?.error) {
    return { success: false, message: data.error };
  }

  return { success: true };
}

/**
 * 現在のGmail連携状態を取得する。
 * テストモードは refresh_token が7日で失効するため、
 * connected_at から6日経過していたら「まもなく失効」の判定を返す。
 */
export async function getGmailConnectionStatus(
  userId: string,
): Promise<GmailConnectionStatus> {
  const { data, error } = await supabase
    .from("gmail_connections")
    .select("connected_at, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      connected: false,
      connectedAt: null,
      status: null,
      daysUntilExpiry: null,
    };
  }

  const connectedAt = new Date(data.connected_at);
  const daysElapsed =
    (Date.now() - connectedAt.getTime()) / (1000 * 60 * 60 * 24);
  const daysUntilExpiry = Math.max(0, Math.ceil(7 - daysElapsed));

  return {
    connected: data.status === "active",
    connectedAt: data.connected_at,
    status: data.status,
    daysUntilExpiry,
  };
}

/**
 * Gmail連携を解除する(DB上のレコードをrevokedに更新)。
 * Googleアカウント自体からのアクセス権削除はユーザーが
 * https://myaccount.google.com/permissions で行う想定。
 */
export async function revokeGmailConnection(userId: string): Promise<void> {
  await supabase
    .from("gmail_connections")
    .update({ status: "revoked" })
    .eq("user_id", userId);
}
