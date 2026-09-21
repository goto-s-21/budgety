import { GmailMessage } from '../types'
import type { ParsedTransaction, PaymentNotificationParser } from '../types'

function parseAmount(value: string): number {
  return Number(value.replace(/[\s,円]/g, '')) || 0
}

function normalizeMerchant(value: string): string {
  return value
    .replace(/[（(][^）)\r\n]*[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSmbcSender(from: string): boolean {
  const normalized = from.toLowerCase()
  return (
    normalized.includes('statement@vpass.ne.jp') ||
    normalized.includes('webmaster@smbc-card.com')
  )
}

export const SmbcUsageNoticeParser: PaymentNotificationParser = {
  name: 'smbc_usage_notice',

  canParse(message: GmailMessage) {
    return (
      isSmbcSender(message.from) &&
      /ご利用日時\s*[：:]\s*\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}/.test(message.body)
    )
  },

  parse(message: GmailMessage): ParsedTransaction | null {
    const dateMatch = message.body.match(
      /ご利用日時\s*[：:]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/
    )

    if (!dateMatch) return null

    const [, year, month, day, hour, minute] = dateMatch
    const afterDate = message.body.slice((dateMatch.index || 0) + dateMatch[0].length)

    const detailMatch = afterDate.match(
      /([^\r\n]+?)\s*[（(][^）)\r\n]*[）)]\s*(?:[\t ]*([\d,]+)\s*円|\r?\n\s*([\d,]+)\s*円)/
    )

    if (!detailMatch) return null

    const merchant = normalizeMerchant(detailMatch[1])
    const amount = parseAmount(detailMatch[2] || detailMatch[3] || '')

    if (!merchant || amount <= 0) return null

    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
      merchant,
      amount,
      paymentMethod: 'smbc_card',
      source: 'gmail',
      sourceId: message.id,
      sourceDetail: '三井住友カード利用速報',
    }
  },
}
