import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

export const SmbcCardParser: PaymentNotificationParser = {
  serviceName: '三井住友カード',

  canParse(message: GmailMessage): boolean {
    return message.from.includes('vpass.ne.jp')
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const body = message.body

    const dateMatch = body.match(/ご利用日時[：:]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/)
    if (!dateMatch) return null

    const [, y, m, d, hh, mm] = dateMatch
    const date = `${y}-${m}-${d}`
    const time = `${hh}:${mm}`

    const afterDate = body.slice(dateMatch.index! + dateMatch[0].length)
    const merchantMatch = afterDate.match(/\s*\n?\s*(.+?)\s*\n/)
    const merchant = merchantMatch ? merchantMatch[1].trim() : null

    const amountMatch = body.match(/([\d,]+)円/)
    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : null

    if (amount === null || !merchant) return null

    return {
      date,
      time,
      merchant,
      amount,
      paymentMethod: '三井住友カード',
      source: 'gmail',
      sourceId: message.id,
    }
  },
}