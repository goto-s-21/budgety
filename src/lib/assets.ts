import { supabase } from './supabase'

export interface AssetSnapshot {
  id: string
  user_id: string
  balance: number
  type: 'reset' | 'adjustment'
  created_at: string
}

export async function fetchSnapshots(userId: string): Promise<AssetSnapshot[]> {
  const { data, error } = await supabase
    .from('asset_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addReset(userId: string, balance: number): Promise<void> {
  const { error } = await supabase
    .from('asset_snapshots')
    .insert({ user_id: userId, balance, type: 'reset' })
  if (error) throw error
}

export async function addAdjustment(userId: string, delta: number): Promise<void> {
  const { error } = await supabase
    .from('asset_snapshots')
    .insert({ user_id: userId, balance: delta, type: 'adjustment' })
  if (error) throw error
}

export function computeTotalAssets(
  snapshots: AssetSnapshot[],
  transactions: Array<{ type: string; amount: number; created_at?: string }>
): number | null {
  // 最新のリセットを探す
  const resets = snapshots.filter((s) => s.type === 'reset')
  if (resets.length === 0) return null
  const latestReset = resets[resets.length - 1]
  const baseTime = new Date(latestReset.created_at).getTime()

  // リセット以降の微調整を合算
  const adjustmentSum = snapshots
    .filter((s) => s.type === 'adjustment' && new Date(s.created_at).getTime() >= baseTime)
    .reduce((sum, s) => sum + s.balance, 0)

  // リセット以降に登録された取引を加減算
  const txDelta = transactions.reduce((sum, tx) => {
    if (!tx.created_at) return sum
    if (new Date(tx.created_at).getTime() < baseTime) return sum
    return tx.type === 'income' ? sum + tx.amount : sum - tx.amount
  }, 0)

  return latestReset.balance + adjustmentSum + txDelta
}
