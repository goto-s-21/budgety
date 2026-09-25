// スクリーンショットから取引を抽出するクライアント側処理。
// 画像を縮小してサーバ(/api/parse-screenshot)へ送り、抽出結果を受け取る。

export interface ExtractedTx {
  date: string | null
  amount: number | null
  merchant: string | null
}

// 送信前に画像を縮小しJPEGへ変換する。
// スクショはPNGで大きくなりがちなため、長辺を抑えてリクエストサイズと料金を下げる。
async function fileToResizedJpeg(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<{ base64: string; mimeType: string }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('この画像形式は読み取れませんでした。PNGまたはJPEGのスクリーンショットを選んでください。')
  }

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像の変換に失敗しました。')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1] ?? ''
  return { base64, mimeType: 'image/jpeg' }
}

export async function extractTransactionsFromImage(file: File): Promise<ExtractedTx[]> {
  const { base64, mimeType } = await fileToResizedJpeg(file)

  const response = await fetch('/api/parse-screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mimeType }),
  })

  if (!response.ok) throw new Error('スクリーンショットの読み取りに失敗しました')
  const data = await response.json()
  return Array.isArray(data.transactions) ? (data.transactions as ExtractedTx[]) : []
}
