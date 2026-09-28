import { supabase } from './supabase'

export interface Budget {
  id: string
  category_id: string
  year_month: string
  amount: number
}

export async function fetchBudgets(userId: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category_id, year_month, amount')
    .eq('user_id', userId)
    .not('year_month', 'is', null)
  if (error) throw error
  return data || []
}

export async function upsertBudget(
  userId: string,
  categoryId: string,
  yearMonth: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) {
    await supabase
      .from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .eq('year_month', yearMonth)
    return
  }
  const { error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userId, category_id: categoryId, year_month: yearMonth, amount },
      { onConflict: 'user_id,category_id,year_month' },
    )
  if (error) throw error
}
