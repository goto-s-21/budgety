import { supabase } from './supabase'

export const DEFAULT_CATEGORIES = [
  { name: '食費' },
  { name: 'コンビニ' },
  { name: '外食' },
  { name: '日用品' },
  { name: '美容' },
  { name: '服・ファッション' },
  { name: '交通' },
  { name: '通信' },
  { name: 'サブスク' },
  { name: '医療' },
  { name: '交際費' },
  { name: '趣味' },
  { name: '旅行' },
  { name: '学習' },
  { name: '家賃・住居' },
  { name: 'その他' },
  { name: '未分類' },
]

export async function ensureDefaultCategories(userId: string) {
  const rows = DEFAULT_CATEGORIES.map((c, index) => ({
    user_id: userId,
    name: c.name,
    sort_order: index,
    is_default: true,
  }))

  const { error } = await supabase
    .from('categories')
    .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true })

  if (error) {
    console.error('初期カテゴリー投入エラー:', error.message)
  }
}

export async function fetchCategories(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order')

  if (error) throw error
  return data
}