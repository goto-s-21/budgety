import { supabase } from '../../lib/supabase'

export async function runGmailSync(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('run-gmail-sync', {
    method: 'POST',
    body: {},
  })

  if (error) throw error
  if (!data?.ok) {
    throw new Error(data?.error || 'Gmail同期の起動に失敗しました')
  }
}
