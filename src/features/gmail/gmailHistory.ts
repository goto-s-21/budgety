import { supabase } from '../../lib/supabase'

export interface GmailImportHistory {
  id: string
  created_at: string
  imported_count: number
  duplicate_count: number
  failed_count: number
}

export async function fetchLatestGmailImportHistory(
  userId: string,
): Promise<GmailImportHistory | null> {
  const { data, error } = await supabase
    .from('import_history')
    .select('id, created_at, imported_count, duplicate_count, failed_count')
    .eq('user_id', userId)
    .eq('source', 'gmail')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}
