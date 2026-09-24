import type { GmailMessage, ParsedTransaction, PaymentNotificationParser } from '../types'

function parseYen(value: string | undefined): number {
  if (!value) return 0
  return Number(value.replace(/[￥¥,\s]/g, '')) || 0
}

// internalDate(エポックms)を日本時間(JST)の日付・時刻に変換する。
// 同期はGitHub Actions(UTC)上で動くため、サーバのTZに依存せず必ずJSTで記録する。
function toJstDateTime(message: GmailMessage): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(Number(message.internalDate)))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour') // 環境によって深夜0時が'24'になるのを補正
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}` }
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

    const { date, time } = toJstDateTime(message)

    return {
      date,
      time,
      merchant: 'メルカリ',
      amount,
      paymentMethod: 'mercari',
      source: 'gmail',
      sourceId: message.id,
      sourceDetail: `メルカリ${productId ? ` ${productId}` : ''}${productName ? ` ${productName}` : ''}`,
    }
  },
}
