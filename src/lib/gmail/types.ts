// src/lib/gmail/types.ts
// Gmail通知メールの共通型とパーサーインターフェース(仕様書16章準拠)

export interface GmailMessage {
  id: string
  from: string
  subject: string
  body: string
  internalDate: string // Gmail APIが返すUnix ms文字列
}

export interface ParsedTransaction {
  date: string // 'YYYY-MM-DD'
  time: string | null // 'HH:mm'
  merchant: string
  amount: number
  paymentMethod: string // 'rakuten_pay' | 'smbc_card' | 'paypay_card' など
  source: 'gmail'
  sourceId: string // Gmail message id (重複防止に使う)
  sourceDetail: string // サービス名(表示用)
}

export interface PaymentNotificationParser {
  name: string
  canParse(message: GmailMessage): boolean
  parse(message: GmailMessage): ParsedTransaction | null
}
