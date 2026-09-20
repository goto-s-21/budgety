import { supabase } from './supabase'

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

export interface UpdateTransactionInput {
  id: string
  userId: string
  type: 'expense' | 'income'
  amount: number
  merchantName: string
  categoryId: string
  date: string
  time?: string
  memo?: string
}

async function resolveMerchantId(userId: string, merchantName: string) {
  const trimmed = merchantName.trim()

  const { data: existing, error: fetchError } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .eq('canonical_name', trimmed)
    .limit(1)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (existing) return existing.id

  const { data: created, error: insertError } = await supabase
    .from('merchants')
    .insert({ user_id: userId, canonical_name: trimmed })
    .select('id')
    .single()

  if (insertError) throw insertError
  return created.id
}

export async function addTransaction(input: AddTransactionInput) {
  const merchantId = await resolveMerchantId(input.userId, input.merchantName)

  const { error } = await supabase.from('transactions').insert({
    user_id: input.userId,
    date: input.date,
    time: input.time || null,
    amount: input.amount,
    type: input.type,
    merchant_id: merchantId,
    category_id: input.categoryId,
    source: 'manual',
    memo: input.memo || null,
    confidence: 'high',
    needs_review: false,
  })

  if (error) throw error
}

export async function updateTransaction(input: UpdateTransactionInput) {
  const merchantId = await resolveMerchantId(input.userId, input.merchantName)

  const { error } = await supabase
    .from('transactions')
    .update({
      date: input.date,
      time: input.time || null,
      amount: input.amount,
      type: input.type,
      merchant_id: merchantId,
      category_id: input.categoryId,
      memo: input.memo || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)

  if (error) throw error
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function fetchTransactions(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, merchants(canonical_name), categories(name, icon)')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('time', { ascending: false })

  if (error) throw error
  return data
}