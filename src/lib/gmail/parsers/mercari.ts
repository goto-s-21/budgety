import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

function parseYen(value: string | undefined): number {
  if (!value) return 0
  return Number(value.replace(/[￥¥,\s]/g, '')) || 0
}

function getMessageDate(message: GmailMessage): string {
  const date = new Date(Number(message.internalDate))
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMessageTime(message: GmailMessage): string | null {
  const date = new Date(Number(message.internalDate))
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function firstMatch(body: string, pattern: RegExp): string | undefined {
  return body.match(pattern)?.[1]?.trim()
}

export const MercariParser: PaymentNotificationParser = {
  name: 'mercari',

  canParse(message) {
    return message.from.toLowerCase().includes('no-reply@mercari.jp')
  },

  parse(message): ParsedTransaction | null {
    const body = message.body

    const productId = firstMatch(body, /商品ID\s*:\s*([^\r\n]+)/)
    const productName = firstMatch(body, /商品名\s*:\s*([^\r\n]+)/)
    const itemPriceText = firstMatch(body, /商品代金\s*:\s*([￥¥]?\s*[\d,]+)/)
    const couponText = firstMatch(body, /クーポン\s*:\s*(?:利用なし|([￥¥]?\s*[\d,]+))/)
    const pointsText = firstMatch(body, /ポイント利用\s*:\s*P\s*([\d,]+)/)

    const itemPrice = parseYen(itemPriceText)
    const coupon = couponText && !/利用なし/.test(couponText) ? parseYen(couponText) : 0
    const points = parseYen(pointsText)
    const amount = itemPrice - coupon - points

    if (!itemPrice || amount <= 0) return null

    return {
      date: getMessageDate(message),
      time: getMessageTime(message),
      merchant: 'メルカリ',
      amount,
      paymentMethod: 'mercari',
      source: 'gmail',
      sourceId: message.id,
      sourceDetail: `メルカリ${productId ? ` ${productId}` : ''}${productName ? ` ${productName}` : ''}`,
    }
  },
}
