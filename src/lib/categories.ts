import { supabase } from './supabase'

export const DEFAULT_CATEGORIES = [
  { name: '食費', icon: '🍚' },
  { name: 'コンビニ', icon: '🏪' },
  { name: '外食', icon: '🍔' },
  { name: '日用品', icon: '🧴' },
  { name: '美容', icon: '💄' },
  { name: '服・ファッション', icon: '👗' },
  { name: '交通', icon: '🚃' },
  { name: '通信', icon: '📱' },
  { name: 'サブスク', icon: '🔁' },
  { name: '医療', icon: '💊' },
  { name: '交際費', icon: '🎁' },
  { name: '趣味', icon: '🎀' },
  { name: '旅行', icon: '✈️' },
  { name: '学習', icon: '📚' },
  { name: '家賃・住居', icon: '🏠' },
  { name: 'その他', icon: '🧾' },
  { name: '未分類', icon: '❔' },
]

export async function ensureDefaultCategories(userId: string) {
  const rows = DEFAULT_CATEGORIES.map((c, index) => ({
    user_id: userId,
    name: c.name,
    icon: c.icon,
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