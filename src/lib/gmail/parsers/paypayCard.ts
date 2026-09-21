// src/lib/gmail/parsers/paypayCard.ts
// PayPayカードの「利用速報」メールをパースする。
//
// 本文形式(実例、3行形式):
// ダイソー／NFC
// 2026年9月11日 16:22
// 330円
//
// PayPay残高払いの通知メールは基本的に届かない想定のため、
// 別途の除外ロジックは設けていない。今後残高払いの通知が確認された場合は
// 送信元/件名で判別して除外するロジックを追加する。

import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

const FROM_PATTERN = /paypaycard-info@mail\.paypay-card\.co\.jp/i
const SUBJECT_PATTERN = /利用速報/
const DATETIME_LINE = /(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/

export const PaypayCardParser: PaymentNotificationParser = {
  name: 'paypay_card',

  canParse(message: GmailMessage): boolean {
    return FROM_PATTERN.test(message.from) && SUBJECT_PATTERN.test(message.subject)
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const lines = message.body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const dateLineIndex = lines.findIndex((l) => DATETIME_LINE.test(l))
    if (dateLineIndex === -1 || dateLineIndex === 0 || dateLineIndex + 1 >= lines.length) {
      return null
    }

    const merchant = lines[dateLineIndex - 1]
    const dateMatch = lines[dateLineIndex].match(DATETIME_LINE)
    const amountLine = lines[dateLineIndex + 1]
    const amountMatch = amountLine.match(/([\d,]+)\s*円/)

    if (!dateMatch || !amountMatch || !merchant) return null

    const [, y, m, d, hh, mm] = dateMatch
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const time = `${hh.padStart(2, '0')}:${mm}`
    const amount = Number(amountMatch[1].replace(/,/g, ''))

    if (!Number.isFinite(amount) || amount <= 0) return null

    return {
      date,
      time,
      merchant,
      amount,
      paymentMethod: 'paypay_card',
      source: 'gmail',
      sourceId: message.id,
      sourceDetail: 'PayPayカード',
    }
  },
}
