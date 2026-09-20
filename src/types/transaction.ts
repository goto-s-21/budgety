export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund'
export type Source = 'gmail' | 'csv' | 'pdf' | 'manual'
export type Confidence = 'high' | 'medium' | 'low'

export interface Category {
  id: string
  name: string
  icon: string | null
  sort_order: number
}

export interface TransactionRow {
  id: string
  user_id: string
  date: string
  time: string | null
  amount: number
  type: TransactionType
  merchant_id: string | null
  category_id: string | null
  payment_method_id: string | null
  source: Source
  source_id: string | null
  source_detail: string | null
  memo: string | null
  confidence: Confidence | null
  needs_review: boolean
  created_at: string
  updated_at: string
  merchants: { canonical_name: string } | null
  categories: { name: string; icon: string | null } | null
}

export interface AddTransactionInput {
  userId: string
  type: 'expense' | 'income'
  amount: number
  merchantName: string
  categoryId: string
  date: string
  time?: string
  memo?: string
}