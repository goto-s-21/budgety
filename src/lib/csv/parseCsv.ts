import Papa from 'papaparse'

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
  rawRowCount: number
  emptyRowCount: number
}

function decodeWithEncoding(buffer: ArrayBuffer, encoding: string): string {
  const decoder = new TextDecoder(encoding)
  return decoder.decode(buffer)
}

function looksBroken(text: string): boolean {
  const replacementChar = '\uFFFD'
  const count = (text.match(new RegExp(replacementChar, 'g')) || []).length
  return count > text.length * 0.01
}

export async function readFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()

  const utf8Text = decodeWithEncoding(buffer, 'utf-8')
  if (!looksBroken(utf8Text)) {
    return utf8Text
  }

  try {
    const sjisText = decodeWithEncoding(buffer, 'shift-jis')
    if (!looksBroken(sjisText)) {
      return sjisText
    }
  } catch {
    // shift-jis decode not supported in this environment, fall through
  }

  return utf8Text
}

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })

  const headers = result.meta.fields || []
  const rows = (result.data || []).filter((row) =>
    Object.values(row).some((v) => String(v ?? '').trim() !== '')
  )

  return {
    headers,
    rows,
    rawRowCount: result.data.length,
    emptyRowCount: result.data.length - rows.length,
  }
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  const text = await readFileAsText(file)
  return parseCsvText(text)
}