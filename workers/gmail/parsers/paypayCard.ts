import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

export const PayPayCardParser: PaymentNotificationParser = {
  serviceName: 'PayPayカード',

  canParse(message: GmailMessage): boolean {
    return message.from.includes('paypay-card.co.jp')
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const body = message.body

    const merchantMatch = body.match(/利用速報\s*\n\s*(.+?)\s*\n/)
    const merchant = merchantMatch ? merchantMatch[1].trim() : null

    const dateMatch = body.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{2}):(\d{2})/)
    if (!dateMatch) return null

    const [, y, m, d, hh, mm] = dateMatch
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const time = `${hh}:${mm}`

    const amountMatch = body.match(/\n\s*([\d,]+)円/)
    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null

    if (amount === null || !merchant) return null

    return {
      date,
      time,
      merchant,
      amount,
      paymentMethod: 'PayPayカード',
      source: 'gmail',
      sourceId: message.id,
    }
  },
}