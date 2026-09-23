import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { fetchCategories } from './lib/categories'
import { fetchTransactions } from './lib/transactions'
import { IconRefresh } from './components/Icons'

export default function App() {
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    if (refreshing) return

    setRefreshing(true)

    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) return

      await Promise.all([
        fetchCategories(user.id),
        fetchTransactions(user.id),
      ])
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void handleRefresh()
  }, [])

  return (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      className={refreshing ? 'refresh-btn spinning' : 'refresh-btn'}
      aria-label="更新"
    >
      <IconRefresh color="var(--muted)" />
    </button>
  )
}
