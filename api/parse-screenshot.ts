import type { VercelRequest, VercelResponse } from '@vercel/node'

// スクリーンショット(決済アプリ・銀行アプリ・レシート・カード明細など)から
// 支出取引を読み取るエンドポイント。カテゴリー分類と同じくGeminiを使う。

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
// base64文字列の上限(約8MBのバイナリ相当)。過大なリクエストとAPI乱用を抑止する。
const MAX_BASE64_LENGTH = 11_000_000

// Vercelの既定ボディ上限(4.5MB)だと画像で不足しうるため引き上げる。
export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

async function callGeminiWithRetry(url: string, body: string, maxRetries = 2): Promise<Response> {
  let lastResponse: Response | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (response.status !== 503) return response
    lastResponse = response
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
    }
  }
  return lastResponse as Response
}

interface ExtractedTx {
  date: string | null
  amount: number | null
  merchant: string | null
}

function sanitize(raw: unknown): ExtractedTx[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item): ExtractedTx | null => {
      if (!item || typeof item !== 'object') return null
      const r = item as Record<string, unknown>
      const dateStr = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null
      const amountNum =
        typeof r.amount === 'number' && Number.isFinite(r.amount)
          ? Math.round(Math.abs(r.amount))
          : typeof r.amount === 'string' && r.amount.trim() !== ''
            ? Math.round(Math.abs(Number(r.amount.replace(/[^\d.-]/g, '')))) || null
            : null
      const merchant = typeof r.merchant === 'string' && r.merchant.trim() !== '' ? r.merchant.trim() : null
      if (dateStr === null && amountNum === null && merchant === null) return null
      return { date: dateStr, amount: amountNum, merchant }
    })
    .filter((x): x is ExtractedTx => x !== null)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { image, mimeType } = req.body as { image?: string; mimeType?: string }

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image (base64) is required' })
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ error: 'image too large' })
  }
  if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
    return res.status(400).json({ error: 'unsupported mimeType' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' })
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'

  const currentYear = new Date().getFullYear()
  const prompt = `あなたは家計簿アプリの取引抽出アシスタントです。
アップロードされた画像は、決済アプリ・銀行アプリ・クレジットカード明細・レシートなどのスクリーンショットです。
この画像から「支出（お金を使った取引）」を読み取ってください。

各取引について次を抽出します:
- date: 取引日を "YYYY-MM-DD" 形式で。年が書かれていない場合は ${currentYear} を補う。日付が全く読み取れない場合は null。
- amount: 金額（円、正の整数）。読み取れない場合は null。
- merchant: 店舗名・利用先の名称。読み取れない場合は null。

ルール:
- 画像に複数の取引が写っている場合は、すべてを配列に含める。1件だけなら1要素の配列。
- 残高・合計・利用可能額・獲得ポイントなど、取引そのものではない数値は含めない。
- チャージ・入金など支出でないものも、金額と相手先が明確なら取引として含めてよい。
- 推測で値を捏造しない。読み取れない項目は null にする。

必ず次のJSON形式のみで回答してください。説明文は不要です。
{"transactions":[{"date":"2026-09-25","amount":3000,"merchant":"アニメイト通販"}]}`

  try {
    const response = await callGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: image } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      })
    )

    if (!response.ok) {
      const errText = await response.text()
      return res.status(502).json({ error: 'Gemini API error', detail: errText })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return res.status(502).json({ error: 'Failed to parse AI response', raw: text })
    }

    const listRaw = (parsed as { transactions?: unknown })?.transactions ?? parsed
    const transactions = sanitize(listRaw)

    return res.status(200).json({ transactions })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', detail: String(err) })
  }
}
