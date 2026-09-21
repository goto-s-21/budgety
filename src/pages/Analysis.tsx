import { useState } from 'react'
import {
  yen,
  thisMonth,
  thisWeek,
  todayKey,
  navigatePeriod,
  formatPeriodLabel,
  isInPeriod,
} from '../lib/formatters'
import type { PeriodUnit } from '../lib/formatters'

interface TxRow {
  id: string
  type: string
  amount: number
  date: string
  merchants: { canonical_name: string } | null
  categories: { name: string; icon: string | null } | null
}

interface Props {
  transactions: TxRow[]
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// カテゴリ配色パレット(固定8色をカテゴリ名でローテーションする)
const PALETTE = [
  '#4C6EF5', '#F76707', '#12B886', '#F03E3E',
  '#7048E8', '#FAB005', '#1098AD', '#E64980',
]
function colorFor(_name: string, index: number): string {
  return PALETTE[index % PALETTE.length]
}

function previousPeriod(unit: PeriodUnit, period: string): string {
  return navigatePeriod(unit, period, -1)
}

export default function Analysis({ transactions }: Props) {
  const [unit, setUnit] = useState<PeriodUnit>('month')
  const [period, setPeriod] = useState(thisMonth())

  function switchUnit(newUnit: PeriodUnit) {
    if (newUnit === 'year') setPeriod(todayKey().slice(0, 4))
    else if (newUnit === 'month') setPeriod(thisMonth())
    else if (newUnit === 'week') setPeriod(thisWeek())
    else setPeriod(todayKey())
    setUnit(newUnit)
  }

  const now = transactions.filter(
    (t) => t.type === 'expense' && isInPeriod(t.date, unit, period),
  )
  const nowIncome = transactions.filter(
    (t) => t.type === 'income' && isInPeriod(t.date, unit, period),
  )

  const prevPeriod = previousPeriod(unit, period)
  const prevExpenses = transactions.filter(
    (t) => t.type === 'expense' && isInPeriod(t.date, unit, prevPeriod),
  )
  const prevTotal = prevExpenses.reduce((a, t) => a + t.amount, 0)

  const total = now.reduce((a, t) => a + t.amount, 0)
  const totalIncome = nowIncome.reduce((a, t) => a + t.amount, 0)
  const diff = total - prevTotal

  const savingsRate = totalIncome > 0 ? ((totalIncome - total) / totalIncome) * 100 : null

  const count = now.length
  const avgAmount = count > 0 ? total / count : 0
  const maxTx = now.reduce((max, t) => (t.amount > (max?.amount || 0) ? t : max), null as TxRow | null)

  const small = now.filter((t) => t.amount <= 500)

  const merchantCounts: Record<string, { count: number; total: number }> = {}
  now.forEach((t) => {
    const name = t.merchants?.canonical_name || '未設定'
    if (!merchantCounts[name]) merchantCounts[name] = { count: 0, total: 0 }
    merchantCounts[name].count += 1
    merchantCounts[name].total += t.amount
  })
  const topMerchants = Object.entries(merchantCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  const weekdayTotals = WEEKDAYS.map((_, i) =>
    now
      .filter((t) => new Date(t.date + 'T00:00:00').getDay() === i)
      .reduce((a, t) => a + t.amount, 0),
  )
  const maxWeekday = Math.max(...weekdayTotals, 1)

  // --- カテゴリ別支出(円グラフ+ランキング) ---
  const categoryTotals: Record<string, { total: number; icon: string | null }> = {}
  now.forEach((t) => {
    const name = t.categories?.name || '未分類'
    if (!categoryTotals[name]) categoryTotals[name] = { total: 0, icon: t.categories?.icon || null }
    categoryTotals[name].total += t.amount
  })
  const categoryRanking = Object.entries(categoryTotals).sort((a, b) => b[1].total - a[1].total)
  const donutSegments = buildDonutSegments(categoryRanking, total)

  // --- カテゴリ別の前期間比較 ---
  const prevCategoryTotals: Record<string, number> = {}
  prevExpenses.forEach((t) => {
    const name = t.categories?.name || '未分類'
    prevCategoryTotals[name] = (prevCategoryTotals[name] || 0) + t.amount
  })
  const categoryComparison = categoryRanking.map(([name, info]) => {
    const prevAmt = prevCategoryTotals[name] || 0
    return { name, current: info.total, prev: prevAmt, diff: info.total - prevAmt }
  })

  // --- 収支の推移(直近6期間) ---
  const trendPeriods: string[] = [period]
  for (let i = 0; i < 5; i++) trendPeriods.unshift(navigatePeriod(unit, trendPeriods[0], -1))
  const trend = trendPeriods.map((p) => {
    const exp = transactions
      .filter((t) => t.type === 'expense' && isInPeriod(t.date, unit, p))
      .reduce((a, t) => a + t.amount, 0)
    const inc = transactions
      .filter((t) => t.type === 'income' && isInPeriod(t.date, unit, p))
      .reduce((a, t) => a + t.amount, 0)
    return { period: p, expense: exp, income: inc }
  })
  const maxTrend = Math.max(...trend.map((t) => Math.max(t.expense, t.income)), 1)

  const recurringCandidates = detectRecurring(
    transactions.filter((t) => t.type === 'expense'),
  )

  return (
    <>
      <div className="section-head">
        <h2>支出分析</h2>
      </div>

      <section className="card">
        <div className="period-bar">
          <div className="period-units">
            {(['year', 'month', 'week', 'day'] as PeriodUnit[]).map((u) => (
              <button
                key={u}
                className={u === unit ? 'punit active' : 'punit'}
                onClick={() => switchUnit(u)}
              >
                {u === 'year' ? '年' : u === 'month' ? '月' : u === 'week' ? '週' : '日'}
              </button>
            ))}
          </div>
          <div className="period-nav">
            <button className="pnav" onClick={() => setPeriod(navigatePeriod(unit, period, -1))}>‹</button>
            <span className="period-label">{formatPeriodLabel(unit, period)}</span>
            <button className="pnav" onClick={() => setPeriod(navigatePeriod(unit, period, 1))}>›</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>支出</h2>
        </div>
        <div className="balance">{yen(total)}</div>
        <p className="sub">
          {prevTotal
            ? `前${unitLabel(unit)}比 ${diff >= 0 ? '+' : ''}${yen(diff)}`
            : `前${unitLabel(unit)}データがありません`}
        </p>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>収支バランス</h2>
        </div>
        <div className="stats">
          <div className="stat">
            <label>収入</label>
            <strong>{yen(totalIncome)}</strong>
          </div>
          <div className="stat">
            <label>支出</label>
            <strong>{yen(total)}</strong>
          </div>
        </div>
        <p className="sub">
          {savingsRate !== null
            ? `貯蓄率 ${savingsRate.toFixed(1)}%`
            : 'この期間の収入データがありません'}
        </p>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>収支の推移</h2>
        </div>
        <div className="trend-chart">
          {trend.map((t) => (
            <div className="trend-col" key={t.period}>
              <div className="trend-bar-wrap">
                <div
                  className="trend-bar income"
                  style={{ height: `${Math.max(2, (t.income / maxTrend) * 100)}%` }}
                />
                <div
                  className="trend-bar expense"
                  style={{ height: `${Math.max(2, (t.expense / maxTrend) * 100)}%` }}
                />
              </div>
              <div className="trend-label">{shortPeriodLabel(unit, t.period)}</div>
            </div>
          ))}
        </div>
        <div className="legend">
          <span className="legend-dot income" /> 収入
          <span className="legend-dot expense" /> 支出
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>カテゴリ別支出</h2>
        </div>
        {categoryRanking.length === 0 && <div className="empty">データがありません。</div>}
        {categoryRanking.length > 0 && (
          <div className="donut-wrap">
            <svg viewBox="0 0 100 100" className="donut">
              {donutSegments.map((seg, i) => (
                <circle
                  key={seg.name}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={colorFor(seg.name, i)}
                  strokeWidth="16"
                  strokeDasharray={`${seg.dash} ${seg.gap}`}
                  strokeDashoffset={seg.offset}
                  transform="rotate(-90 50 50)"
                />
              ))}
            </svg>
            <div className="donut-center">
              <div className="donut-total">{yen(total)}</div>
            </div>
          </div>
        )}
        {categoryRanking.map(([name, info], i) => (
          <div className="spend-row" key={name}>
            <span className="legend-dot" style={{ background: colorFor(name, i) }} />
            <div className="grow">
              <div className="name">{info.icon ? `${info.icon} ` : ''}{name}</div>
              <div className="sub">{total > 0 ? ((info.total / total) * 100).toFixed(1) : '0'}%</div>
            </div>
            <div className="amount">{yen(info.total)}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>カテゴリ別 前{unitLabel(unit)}比較</h2>
        </div>
        {categoryComparison.length === 0 && <div className="empty">データがありません。</div>}
        {categoryComparison.map((c) => (
          <div className="spend-row" key={c.name}>
            <div className="grow">
              <div className="name">{c.name}</div>
              <div className="sub">
                前{unitLabel(unit)} {yen(c.prev)} → 今{unitLabel(unit)} {yen(c.current)}
              </div>
            </div>
            <div className={c.diff > 0 ? 'amount up' : c.diff < 0 ? 'amount down' : 'amount'}>
              {c.diff >= 0 ? '+' : ''}{yen(c.diff)}
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>支出頻度</h2>
        </div>
        <div className="stats">
          <div className="stat">
            <label>利用回数</label>
            <strong>{count}回</strong>
          </div>
          <div className="stat">
            <label>平均支出額</label>
            <strong>{yen(avgAmount)}</strong>
          </div>
        </div>
        <p className="sub">
          {maxTx
            ? `最大支出：${maxTx.merchants?.canonical_name || '未設定'}（${yen(maxTx.amount)}）`
            : 'データがありません'}
        </p>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>小額支出</h2>
        </div>
        <p className="sub">
          小額支出：{small.length}回 / {yen(small.reduce((a, t) => a + t.amount, 0))}
        </p>
        <p className="sub">500円以下の利用回数と合計です。</p>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>よく利用する店舗</h2>
        </div>
        {topMerchants.length === 0 && <div className="empty">データがありません。</div>}
        {topMerchants.map(([name, info]) => (
          <div className="spend-row" key={name}>
            <div className="grow">
              <div className="name">{name}</div>
              <div className="sub">{info.count}回</div>
            </div>
            <div className="amount">{yen(info.total)}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="section-head">
          <h2>曜日別支出</h2>
        </div>
        <div className="weekday-chart">
          {weekdayTotals.map((v, i) => (
            <div className="weekday-col" key={i}>
              <div className="weekday-bar-wrap">
                <div
                  className="weekday-bar"
                  style={{ height: `${Math.max(4, (v / maxWeekday) * 100)}%` }}
                />
              </div>
              <div className="weekday-label">{WEEKDAYS[i]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>定期支出候補</h2>
        </div>
        {recurringCandidates.length === 0 && (
          <div className="empty">まだ十分なデータがありません。</div>
        )}
        {recurringCandidates.map((c) => (
          <div className="spend-row" key={c.merchant}>
            <div className="grow">
              <div className="name">{c.merchant}</div>
              <div className="sub">
                約{c.intervalDays}日ごと・平均{yen(c.avgAmount)}／定期的に発生している可能性があります
              </div>
            </div>
          </div>
        ))}
      </section>
    </>
  )
}

function unitLabel(unit: PeriodUnit): string {
  if (unit === 'year') return '年'
  if (unit === 'month') return '月'
  if (unit === 'week') return '週'
  return '日'
}

// 推移グラフの軸ラベルを短縮表示する
function shortPeriodLabel(unit: PeriodUnit, period: string): string {
  if (unit === 'year') return period
  if (unit === 'month') return `${Number(period.split('-')[1])}月`
  if (unit === 'week') {
    const [, m, d] = period.split('-')
    return `${Number(m)}/${Number(d)}`
  }
  const [, m, d] = period.split('-')
  return `${Number(m)}/${Number(d)}`
}

interface DonutSegment {
  name: string
  dash: number
  gap: number
  offset: number
}

// SVG円周(半径40, 円周長=2*PI*40≈251.2)に対するstrokeDasharrayを計算する
function buildDonutSegments(
  ranking: [string, { total: number; icon: string | null }][],
  total: number,
): DonutSegment[] {
  const circumference = 2 * Math.PI * 40
  if (total <= 0) return []
  let cumulative = 0
  return ranking.map(([name, info]) => {
    const fraction = info.total / total
    const dash = fraction * circumference
    const gap = circumference - dash
    const offset = -cumulative * circumference
    cumulative += fraction
    return { name, dash, gap, offset }
  })
}

interface RecurringCandidate {
  merchant: string
  intervalDays: number
  avgAmount: number
}

function detectRecurring(expenses: TxRow[]): RecurringCandidate[] {
  const byMerchant: Record<string, TxRow[]> = {}
  expenses.forEach((t) => {
    const name = t.merchants?.canonical_name
    if (!name) return
    if (!byMerchant[name]) byMerchant[name] = []
    byMerchant[name].push(t)
  })

  const results: RecurringCandidate[] = []

  Object.entries(byMerchant).forEach(([name, txs]) => {
    if (txs.length < 3) return
    const sorted = [...txs].sort((a, b) => (a.date < b.date ? -1 : 1))

    const intervals: number[] = []
    const amounts: number[] = []

    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date + 'T00:00:00')
      const d2 = new Date(sorted[i].date + 'T00:00:00')
      const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
      const amtDiff = Math.abs(sorted[i].amount - sorted[i - 1].amount)
      const amtRatio = amtDiff / Math.max(sorted[i - 1].amount, 1)

      if (days >= 25 && days <= 35 && amtRatio <= 0.1) {
        intervals.push(days)
        amounts.push(sorted[i].amount, sorted[i - 1].amount)
      }
    }

    if (intervals.length >= 2) {
      const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
      results.push({ merchant: name, intervalDays: avgInterval, avgAmount })
    }
  })

  return results
}