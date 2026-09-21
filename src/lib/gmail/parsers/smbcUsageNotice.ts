import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

function parseAmount(value: string): number {
  return Number(value.replace(/[\s,円]/g, '')) || 0
}

function normalizeMerchant(value: string): string {
  return value
    .replace(/[（(][^）)\r\n]*[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const SmbcUsageNoticeParser: PaymentNotificationParser = {
  name: 'smbc_usage_notice',

  canParse(message) {
    return (
      message.from.toLowerCase().includes('webmaster@smbc-card.com') &&
      /ご利用日時\s*[：:]\s*\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}/.test(message.body)
    )
  },

  parse(message): ParsedTransaction | null {
    const dateMatch = message.body.match(
      /ご利用日時\s*[：:]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/
    )

    if (!dateMatch) return null

    const [, year, month, day, hour, minute] = dateMatch

    const detailMatch = message.body.match(
      /([^\r\n]+?)\s*[（(][^）)\r\n]*[）)]\s*[\t ]*([\d,]+)\s*円/
    )

    if (!detailMatch) return null

    const merchant = normalizeMerchant(detailMatch[1])
    const amount = parseAmount(detailMatch[2])

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
