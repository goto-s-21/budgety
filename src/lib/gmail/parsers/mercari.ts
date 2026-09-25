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

// メルペイ本文の '2026/09/25 18:20' 形式(JST表記)を取り出す。無ければinternalDateにフォールバック。
function parseBodyDateTime(message: GmailMessage, raw: string | undefined): { date: string; time: string } {
  const m = raw?.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})[^\d]+(\d{1,2}):(\d{2})/)
  if (!m) return toJstDateTime(message)
  const [, y, mo, d, hh, mm] = m
  return { date: `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`, time: `${hh.padStart(2, '0')}:${mm}` }
}

function firstMatch(body: string, pattern: RegExp): string | undefined {
  return body.match(pattern)?.[1]?.trim()
}

// メルカリのマーケット購入(商品代金・クーポン・ポイント利用の内訳を持つ)を取引に変換する。
function parseMarketplacePurchase(message: GmailMessage): ParsedTransaction | null {
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
}

// メルカード(クレジット)の利用通知を取引に変換する。
// 例: 店舗名 アニメイト通販 / 決済金額 ￥3,000 / 決済日時 2026/09/25 18:20
function parseMercardUsage(message: GmailMessage): ParsedTransaction | null {
  const body = message.body

  // メルカードは「ラベル改行値」の複数行形式。\s*が改行を含むため両形式に耐える。
  const store = firstMatch(body, /店舗名\s*[:：]?\s*([^\r\n]+)/)
  const amountText = firstMatch(body, /決済金額\s*[:：]?\s*([￥¥]?\s*[\d,]+)/)
  const dateTimeRaw = firstMatch(body, /決済日時\s*[:：]?\s*([^\r\n]+)/)

  const amount = parseYen(amountText)
  if (!store || amount <= 0) return null

  const { date, time } = parseBodyDateTime(message, dateTimeRaw)

  return {
    date,
    time,
    merchant: store,
    amount,
    paymentMethod: 'mercard',
    source: 'gmail',
    sourceId: message.id,
    sourceDetail: `メルカード ${store}`,
  }
}

// 銀行からメルペイ残高へのチャージ(入金)を取引に変換する。
// ユーザー方針: 銀行口座から出金される実支出として支出計上する。
// 例: チャージ金額 ￥1,000 / 銀行名 ゆうちょ銀行
function parseCharge(message: GmailMessage): ParsedTransaction | null {
  const body = message.body

  const amountText = firstMatch(body, /チャージ金額\s*[:：]?\s*([￥¥]?\s*[\d,]+)/)
  const bank = firstMatch(body, /銀行名\s*[:：]?\s*([^\r\n]+)/)

  const amount = parseYen(amountText)
  if (amount <= 0) return null

  const { date, time } = toJstDateTime(message)

  return {
    date,
    time,
    merchant: bank ? `${bank}チャージ` : 'メルペイチャージ',
    amount,
    paymentMethod: 'merpay_charge',
    source: 'gmail',
    sourceId: message.id,
    sourceDetail: `メルペイチャージ${bank ? ` ${bank}` : ''}`,
  }
}

export const MercariParser: PaymentNotificationParser = {
  name: 'mercari',

  canParse(message) {
    return message.from.toLowerCase().includes('no-reply@mercari.jp')
  },

  // 同じ送信元(no-reply@mercari.jp)から複数種類の通知が届くため、本文の特徴で振り分ける。
  parse(message): ParsedTransaction | null {
    const body = message.body

    if (/チャージ金額/.test(body)) return parseCharge(message)
    if (/決済金額/.test(body) && /店舗名/.test(body)) return parseMercardUsage(message)
    if (/商品代金/.test(body)) return parseMarketplacePurchase(message)

    return null
  },
}
