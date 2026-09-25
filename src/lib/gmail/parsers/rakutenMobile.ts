// src/lib/gmail/parsers/rakutenMobile.ts
// 楽天モバイルの「お支払い料金確定のお知らせ」メールをパースする。
// 固定費だが実際にカードから引き落とされるため支出として記録する。
//
// 本文の要点(実例):
//   【1】今月のお支払い料金は
//   971 円 でした！
//   利用料金    971 円
//   楽天ポイント利用    0 円
//
// 実際にカードへ請求される額 = 利用料金 - 楽天ポイント利用。
// 支払い日は締め日により異なり本文に無いため、受信日時(JST)を取引日とする。

import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

const FROM_PATTERN = /mobile\.rakuten\.co\.jp/i
const SUBJECT_PATTERN = /お支払い料金確定/

// internalDate(エポックms)を日本時間(JST)の日付・時刻に変換する。
function toJstDateTime(message: GmailMessage): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(Number(message.internalDate)))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour')
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` }
}

function extractYen(body: string, label: string): number | null {
  const m = body.match(new RegExp(`${label}\\s*([\\d,]+)\\s*円`))
  if (!m) return null
  return Number(m[1].replace(/,/g, ''))
}

export const RakutenMobileParser: PaymentNotificationParser = {
  name: 'rakuten_mobile',

  canParse(message: GmailMessage): boolean {
    return FROM_PATTERN.test(message.from) && SUBJECT_PATTERN.test(message.subject)
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const body = message.body

    const usage = extractYen(body, '利用料金')
    if (usage === null || !Number.isFinite(usage)) return null
    const pointsUsed = extractYen(body, '楽天ポイント利用') ?? 0
    const amount = usage - pointsUsed
    if (amount <= 0) return null

    // '2026年09月度' があれば表示用に添える
    const period = body.match(/(\d{4})年(\d{1,2})月度/)?.[0]
    const { date, time } = toJstDateTime(message)

    return {
      date,
      time,
      merchant: '楽天モバイル',
      amount,
      paymentMethod: 'rakuten_mobile',
      source: 'gmail',
      sourceId: message.id,
      sourceDetail: `楽天モバイル${period ? ` ${period}` : ''}`,
    }
  },
}
