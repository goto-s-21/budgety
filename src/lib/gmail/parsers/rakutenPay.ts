// src/lib/gmail/parsers/rakutenPay.ts
// 楽天ペイの「お支払い完了のお知らせ」メールをパースする。
//
// 本文形式(実例、ラベル行と値行が交互に並ぶ):
// ご利用店舗
// キャンドゥエミオ　狭山市店
// ...
// ご利用日時
// 2026/08/23(日) 20:35
// ...
// 決済総額
// ¥330
// 楽天ポイント
// 0
// 楽天ペイ残高
// ¥0
// クレジットカード
// ¥330
//
// 「クレジットカード」欄が¥0の場合は、残高のみでの決済とみなし取り込み対象外とする
// (カード払いの支出のみを記録する方針)。

import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

const FROM_PATTERN = /no-reply@pay\.rakuten\.co\.jp/i
const SUBJECT_PATTERN = /楽天ペイ.*お支払い完了/

function extractValueAfterLabel(lines: string[], label: string): string | null {
  const idx = lines.findIndex((l) => l === label)
  if (idx === -1 || idx + 1 >= lines.length) return null
  return lines[idx + 1]
}

export const RakutenPayParser: PaymentNotificationParser = {
  name: 'rakuten_pay',

  canParse(message: GmailMessage): boolean {
    return FROM_PATTERN.test(message.from) && SUBJECT_PATTERN.test(message.subject)
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const lines = message.body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const merchant = extractValueAfterLabel(lines, 'ご利用店舗')
    const dateTimeRaw = extractValueAfterLabel(lines, 'ご利用日時')
    const cardAmountRaw = extractValueAfterLabel(lines, 'クレジットカード')

    if (!merchant || !dateTimeRaw || !cardAmountRaw) return null

    const cardAmount = Number(cardAmountRaw.replace(/[¥,]/g, ''))
    if (!Number.isFinite(cardAmount) || cardAmount <= 0) {
      // クレジットカード欄が0円 = 残高払いのみの決済。今回は取り込み対象外。
      return null
    }

    // '2026/08/23(日) 20:35' 形式から日時を取り出す
    const dtMatch = dateTimeRaw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2}).*?(\d{1,2}):(\d{2})/)
    if (!dtMatch) return null
    const [, y, m, d, hh, mm] = dtMatch
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const time = `${hh.padStart(2, '0')}:${mm}`

    return {
      date,
      time,
      merchant,
      amount: cardAmount,
      paymentMethod: 'rakuten_pay',
      source: 'gmail',
      sourceId: message.id,
      sourceDetail: '楽天ペイ',
    }
  },
}
