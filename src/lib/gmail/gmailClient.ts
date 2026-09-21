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

// メッセージのpayloadから本文テキストを再帰的に取り出す(multipart対応)
function extractBody(payload: any): string {
  if (!payload) return ''

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    // text/plainが無ければ最初に見つかったパートを再帰的に探す
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
