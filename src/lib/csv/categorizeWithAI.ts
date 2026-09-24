export type CategorizeItem = { index: number; merchant: string; amount: number }
export type CategorizeResult = { index: number; category: string }

// 1リクエストあたりの件数上限。大きなCSVでも出力トークン上限・タイムアウトに
// 掛からないよう分割して送る。1バッチが失敗しても他バッチの結果は活かす。
const BATCH_SIZE = 40

async function categorizeBatch(items: CategorizeItem[]): Promise<CategorizeResult[]> {
  const response = await fetch('/api/categorize-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!response.ok) throw new Error('AIカテゴリー判定に失敗しました')
  const data = await response.json()
  return Array.isArray(data.results) ? (data.results as CategorizeResult[]) : []
}

export async function categorizeWithAI(items: CategorizeItem[]): Promise<CategorizeResult[]> {
  const batches: CategorizeItem[][] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, i + BATCH_SIZE))
  }

  const all: CategorizeResult[] = []
  let anySuccess = false
  let lastError: unknown = null

  for (const batch of batches) {
    try {
      all.push(...(await categorizeBatch(batch)))
      anySuccess = true
    } catch (e) {
      // このバッチは諦め、他バッチの結果は活かす（未返却のindexは既定カテゴリのまま）
      lastError = e
    }
  }

  // 1件も成功しなかった場合のみ、呼び出し側にエラーを伝える（従来どおりの挙動）
  if (!anySuccess && batches.length > 0) {
    throw lastError instanceof Error ? lastError : new Error('AIカテゴリー判定に失敗しました')
  }

  return all
}
