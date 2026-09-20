import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

export const RakutenPayParser: PaymentNotificationParser = {
  serviceName: '楽天ペイ',

  canParse(message: GmailMessage): boolean {
    return message.from.includes('pay.rakuten.co.jp')
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const body = message.body

    const merchantMatch = body.match(/ご利用店舗\s*\n\s*(.+?)\s*\n/)
    const merchant = merchantMatch ? merchantMatch[1].trim() : null

    const dateMatch = body.match(/ご利用日時\s*\n\s*(\d{4})\/(\d{2})\/(\d{2}).*?(\d{2}):(\d{2})/)
    if (!dateMatch) return null

    const [, y, m, d, hh, mm] = dateMatch
    const date = `${y}-${m}-${d}`
    const time = `${hh}:${mm}`

    const amountMatch = body.match(/決済総額\s*\n\s*[¥￥]?([\d,]+)/)
    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null

    if (amount === null || !merchant) return null

    return {
      date,
      time,
      merchant,
      amount,
      paymentMethod: '楽天ペイ',
      source: 'gmail',
      sourceId: message.id,
    }
  },
}