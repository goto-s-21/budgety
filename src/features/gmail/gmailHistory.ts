import { supabase } from '../../lib/supabase'

export interface GmailImportHistory {
  id: string
  created_at: string
  imported_count: number
  duplicate_count: number
  failed_count: number
}

export interface GmailSyncItem {
  id: string
  source_id: string | null
  message_subject: string | null
  message_from: string | null
  merchant_name: string | null
  transaction_date: string | null
  amount: number | null
  result: 'imported' | 'duplicate' | 'failed' | string
  error_message: string | null
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

export async function fetchGmailSyncItems(
  importHistoryId: string,
): Promise<GmailSyncItem[]> {
  const { data, error } = await supabase
    .from('gmail_sync_items')
    .select(
      'id, source_id, message_subject, message_from, merchant_name, transaction_date, amount, result, error_message',
    )
    .eq('import_history_id', importHistoryId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}
