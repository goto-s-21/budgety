import { supabase } from './supabase'

export interface Budget {
  id: string
  category_id: string
  amount: number
}

export async function fetchBudgets(userId: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category_id, amount')
    .eq('user_id', userId)
  if (error) throw error
  return data || []
}

export async function upsertBudget(userId: string, categoryId: string, amount: number): Promise<void> {
  if (amount <= 0) {
    await supabase.from('budgets').delete().eq('user_id', userId).eq('category_id', categoryId)
    return
  }
  const { error } = await supabase
    .from('budgets')
    .upsert({ user_id: userId, category_id: categoryId, amount }, { onConflict: 'user_id,category_id' })
  if (error) throw error
}
