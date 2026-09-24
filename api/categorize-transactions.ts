import type { VercelRequest, VercelResponse } from '@vercel/node'

const CATEGORY_LIST = [
  '食費', 'コンビニ', '外食', '日用品', '美容',
  '服・ファッション', '交通', '通信', 'サブスク', '医療',
  '交際費', '趣味', '旅行', '学習', '家賃・住居', 'その他',
]

async function callGeminiWithRetry(
  url: string,
  body: string,
  maxRetries = 2
): Promise<Response> {
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })

    if (response.status !== 503) {
      return response
    }

    lastResponse = response
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
    }
  }

  return lastResponse as Response
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { items } = req.body as { items: { index: number; merchant: string; amount: number }[] }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items is required' })
  }

  // 1リクエストあたりの件数を制限（トークン超過とAPI乱用の抑止）。
  // クライアントはBATCH_SIZE(40)ずつ送るため通常の利用では掛からない。
  if (items.length > 100) {
    return res.status(400).json({ error: 'too many items (max 100 per request)' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' })
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'

  const prompt = `あなたは家計簿アプリのカテゴリー分類アシスタントです。
以下の取引リストそれぞれに対して、最も適切なカテゴリーを次の中から1つ選んでください。
カテゴリー一覧: ${CATEGORY_LIST.join(', ')}

分類の目安:
- コンビニ（セブンイレブン、ローソン、ファミリーマートなど）は「コンビニ」
- レストラン、カフェ、ファストフードは「外食」
- スーパー、食材の購入は「食費」
- Netflix、Spotify、その他月額サービスは「サブスク」
- 携帯代、Wi-Fiは「通信」
- 判断できない場合のみ「その他」

取引リスト（index, 店舗名, 金額）:
${items.map((i) => `${i.index}: ${i.merchant} / ${i.amount}円`).join('\n')}

必ず次のJSON配列形式のみで回答してください。説明文は不要です。
[{"index":0,"category":"食費"},{"index":1,"category":"日用品"}]`

  try {
    const response = await callGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      })
    )

    if (!response.ok) {
      const errText = await response.text()
      return res.status(502).json({ error: 'Gemini API error', detail: errText })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'

    let results: { index: number; category: string }[] = []
    try {
      results = JSON.parse(text)
    } catch {
      return res.status(502).json({ error: 'Failed to parse AI response', raw: text })
    }

    if (!Array.isArray(results)) {
      return res.status(502).json({ error: 'Unexpected AI response shape', raw: text })
    }

    const validCategories = new Set(CATEGORY_LIST)
    const sanitized = results.map((r) => ({
      index: r.index,
      category: validCategories.has(r.category) ? r.category : 'その他',
    }))

    return res.status(200).json({ results: sanitized })
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', detail: String(err) })
  }
}