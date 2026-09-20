import { useEffect, useState, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ensureDefaultCategories, fetchCategories } from './lib/categories'
import { addTransaction, updateTransaction, deleteTransaction, fetchTransactions } from './lib/transactions'
import BottomNav from './components/BottomNav'
import type { ViewName } from './components/BottomNav'
import AddSheet from './components/AddSheet'
import type { EditableTransaction } from './components/AddSheet'
import Home from './pages/Home'
import Analysis from './pages/Analysis'
import History from './pages/History'
import More from './pages/More'
import Import from './pages/Import'
import './styles/theme.css'

type PageName = ViewName | 'import'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewName>('home')
  const [page, setPage] = useState<PageName>('home')
  const [addOpen, setAddOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<EditableTransaction | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const initialized = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session && !initialized.current) {
        initialized.current = true
        loadData(data.session.user.id)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession && !initialized.current) {
        initialized.current = true
        loadData(newSession.user.id)
      }
      if (!newSession) {
        initialized.current = false
        setCategories([])
        setTransactions([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadData(userId: string) {
    await ensureDefaultCategories(userId)
    const [cats, txs] = await Promise.all([fetchCategories(userId), fetchTransactions(userId)])
    setCategories(cats || [])
    setTransactions(txs || [])
  }

  async function refreshTransactions() {
    if (!session) return
    const txs = await fetchTransactions(session.user.id)
    setTransactions(txs || [])
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  function changeView(v: ViewName) {
    setView(v)
    setPage(v)
  }

  function openAddNew() {
    setEditingTx(null)
    setAddOpen(true)
  }

  function openEdit(tx: any) {
    setEditingTx({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      merchantName: tx.merchants?.canonical_name || '',
      categoryId: tx.category_id || '',
      date: tx.date,
      memo: tx.memo,
    })
    setAddOpen(true)
  }

  function closeSheet() {
    setAddOpen(false)
    setEditingTx(null)
  }

  async function handleSubmit(input: {
    type: 'expense' | 'income'
    amount: number
    merchantName: string
    categoryId: string
    date: string
    memo?: string
  }) {
    if (!session) return
    if (editingTx) {
      await updateTransaction({ id: editingTx.id, userId: session.user.id, ...input })
    } else {
      await addTransaction({ userId: session.user.id, ...input })
    }
    await refreshTransactions()
  }

  async function handleDeleteTransaction(id: string) {
    await deleteTransaction(id)
    await refreshTransactions()
  }

  if (loading) return null

  if (!session) {
    return (
      <div className="login-screen">
        <div className="brand"><span>♥</span>Budgety</div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          支出をできるだけ自動で集める家計管理アプリ
        </p>
        <button className="google-btn" onClick={signInWithGoogle}>
          Googleでログイン
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span>♥</span>Budgety</div>
        <div className="month">{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}</div>
      </header>

      {page === 'home' && (
        <Home
          transactions={transactions}
          onSeeAnalysis={() => changeView('analysis')}
          onSeeHistory={() => changeView('history')}
        />
      )}
      {page === 'analysis' && <Analysis transactions={transactions} />}
      {page === 'history' && (
        <History transactions={transactions} onAdd={openAddNew} onEdit={openEdit} />
      )}
      {page === 'more' && (
        <More
          userEmail={session.user.email}
          onSignOut={signOut}
          onOpenImport={() => setPage('import')}
        />
      )}
      {page === 'import' && (
        <Import
          userId={session.user.id}
          categories={categories}
          onDone={() => {
            refreshTransactions()
            changeView('history')
          }}
          onBack={() => setPage('more')}
        />
      )}

      {page !== 'import' && <BottomNav active={view} onChange={changeView} onAdd={openAddNew} />}

      <AddSheet
        open={addOpen}
        categories={categories}
        editing={editingTx}
        onClose={closeSheet}
        onSubmit={handleSubmit}
        onDelete={handleDeleteTransaction}
      />
    </div>
  )
}