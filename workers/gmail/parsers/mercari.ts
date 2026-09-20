import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

export const MercariParser: PaymentNotificationParser = {
  serviceName: 'メルカリ',

  canParse(message: GmailMessage): boolean {
    return message.from.includes('mercari.jp')
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const body = message.body

    const amountMatch = body.match(/商品代金\s*[:：]\s*[¥￥]([\d,]+)/)
    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null

    if (amount === null) return null

    const receivedDate = new Date(Number(message.internalDate))
    const date = receivedDate.toISOString().slice(0, 10)

    return {
      date,
      time: null,
      merchant: 'メルカリ',
      amount,
      paymentMethod: 'メルカリ',
      source: 'gmail',
      sourceId: message.id,
    }
  },
}