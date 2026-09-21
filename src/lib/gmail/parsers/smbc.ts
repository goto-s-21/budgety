// src/lib/gmail/parsers/smbc.ts
// 三井住友カード(Vpass)の利用通知メールをパースする。
//
// 本文形式(実例):
// ご利用日時：2026/09/11 17:09
// マクドナルドモバイルオーダー／ＡＰ（買物）
// 450円

import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

const FROM_PATTERN = /statement@vpass\.ne\.jp/i
const USAGE_LINE = /ご利用日時[：:]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/

export const SmbcCardParser: PaymentNotificationParser = {
  name: 'smbc_card',

  canParse(message: GmailMessage): boolean {
    return FROM_PATTERN.test(message.from) && USAGE_LINE.test(message.body)
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const dateMatch = message.body.match(USAGE_LINE)
    if (!dateMatch) return null

    const [, y, m, d, hh, mm] = dateMatch
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const time = `${hh.padStart(2, '0')}:${mm}`

    // 利用日時の行以降から、店舗名の行と金額の行を取り出す。
    // 店舗名行は日時行の直後、金額行はその次に現れる「◯円」の行。
    const lines = message.body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const usageLineIndex = lines.findIndex((l) => USAGE_LINE.test(l))
    if (usageLineIndex === -1 || usageLineIndex + 2 >= lines.length) return null

    const merchantLine = lines[usageLineIndex + 1]
    const amountLine = lines[usageLineIndex + 2]

    const amountMatch = amountLine.match(/([\d,]+)\s*円/)
    if (!amountMatch) return null

    const amount = Number(amountMatch[1].replace(/,/g, ''))
    // 店舗名の末尾にある「（買物）」等の種別表記は取り除く
    const merchant = merchantLine.replace(/[（(][^（）()]*[）)]\s*$/, '').trim()

    if (!merchant || !Number.isFinite(amount) || amount <= 0) return null

    return {
      date,
      time,
      merchant,
      amount,
      paymentMethod: 'smbc_card',
      source: 'gmail',
      sourceId: message.id,
      sourceDetail: '三井住友カード',
    }
  },
}
