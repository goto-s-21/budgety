export type CategorizeItem = { index: number; merchant: string; amount: number }
export type CategorizeResult = { index: number; category: string }

export async function categorizeWithAI(items: CategorizeItem[]): Promise<CategorizeResult[]> {
  const response = await fetch('/api/categorize-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })

  if (!response.ok) {
    throw new Error('AIカテゴリー判定に失敗しました')
  }

  const data = await response.json()
  return data.results as CategorizeResult[]
}