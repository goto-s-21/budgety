// src/lib/gmail/gmailClient.ts
// Gmail APIとのやり取りを行う薄いクライアント。
// refresh_tokenからaccess_tokenを再発行し、指定期間内のメールを検索・取得する。

import { google } from 'googleapis'
import type { GmailMessage } from './types'

export interface GoogleTokens {
  refreshToken: string
  accessToken: string | null
}

export interface RefreshedTokenResult {
  accessToken: string
  expiresAt: Date
}

function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が設定されていません')
  }
  return new google.auth.OAuth2(clientId, clientSecret)
}

// refresh_tokenを使ってaccess_tokenを再発行する
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedTokenResult> {
  const oauth2Client = createOAuthClient()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()
  if (!credentials.access_token) {
    throw new Error('access_tokenの再発行に失敗しました')
  }

  return {
    accessToken: credentials.access_token,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600_000),
  }
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, 'base64').toString('utf-8')
}

// HTML メールのタグを除去してプレーンテキストに変換する。
// <br>/<p>/<div>/<tr>/<li> は改行に変換し、他タグは削除する。
function stripHtml(html: string): string {
  return html
    .replace(/<(br|p|div|tr|li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// メッセージのpayloadから本文テキストを再帰的に取り出す(multipart対応)。
// text/plain を優先し、HTML しかなければタグを剥がして返す。
function extractBody(payload: any): string {
  if (!payload) return ''

  // 単一パート: mimeType に応じて処理
  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data)
    return payload.mimeType === 'text/html' ? stripHtml(raw) : raw
  }

  if (payload.parts) {
    // text/plain を最優先
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    // text/html をフォールバック(タグ除去)
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtml(decodeBase64Url(part.body.data))
      }
    }
    // ネストされたマルチパートを再帰的に探す
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }

  return ''
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((x: any) => x.name.toLowerCase() === name.toLowerCase())
  return h?.value || ''
}

// afterDate('YYYY/MM/DD')以降に受信したメールを検索し、本文まで取得して返す
export async function fetchMessagesSince(accessToken: string, afterDate: string): Promise<GmailMessage[]> {
  const oauth2Client = createOAuthClient()
  oauth2Client.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${afterDate}`,
    maxResults: 100,
  })

  const ids = (listRes.data.messages || []).map((m) => m.id!).filter(Boolean)
  const messages: GmailMessage[] = []

  for (const id of ids) {
    const msgRes = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    })

    const headers = msgRes.data.payload?.headers || []
    const body = extractBody(msgRes.data.payload)

    messages.push({
      id,
      from: getHeader(headers, 'From'),
      subject: getHeader(headers, 'Subject'),
      body,
      internalDate: msgRes.data.internalDate || '',
    })
  }

  return messages
}
