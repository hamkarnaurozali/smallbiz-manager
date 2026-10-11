import { round2 } from './money.js'
import { addDays, diffDays, monthKey, monthStart, weekStart, todayStr } from './dates.js'

export const RANGES = ['today', '7d', '30d', 'all']

export function rangeBounds(range, today = todayStr()) {
  switch (range) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    default:
      return { from: null, to: null }
  }
}

export function inRange(date, from, to) {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function filterByDate(records, from, to) {
  return records.filter((r) => inRange(r.date, from, to))
}

const pct = (num, den) => (den > 0 ? (num / den) * 100 : null)

/**
 * Core formulas, used everywhere:
 *   revenue      = sum(sale.revenue)
 *   cogs         = sum(sale.cogs)           (cost of the goods actually sold)
 *   grossProfit  = revenue - cogs
 *   netProfit    = grossProfit - operating expenses
 * Product purchase costs are never added to operating expenses (no double counting).
 */
export function summarize(sales, expenses) {
  let revenue = 0
  let cogs = 0
  for (const s of sales) {
    revenue += s.revenue
    cogs += s.cogs
  }
  let opex = 0
  for (const e of expenses) opex += e.amount
  revenue = round2(revenue)
  cogs = round2(cogs)
  opex = round2(opex)
  const grossProfit = round2(revenue - cogs)
  const netProfit = round2(grossProfit - opex)
  return {
    revenue,
    cogs,
    opex,
    grossProfit,
    netProfit,
    grossMargin: pct(grossProfit, revenue),
    netMargin: pct(netProfit, revenue),
    count: sales.length,
  }
}

export function periodKey(date, granularity) {
  if (granularity === 'month') return monthStart(date)
  if (granularity === 'week') return weekStart(date)
  return date
}

function nextKey(key, granularity) {
  if (granularity === 'day') return addDays(key, 1)
  if (granularity === 'week') return addDays(key, 7)
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m, 1) // month index m is next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Group sales + expenses into day / week (Mon-start) / month buckets, filling gaps with zeros. */
export function groupByPeriod(sales, expenses, granularity, from = null, to = null) {
  const buckets = new Map()
  const get = (k) => {
    if (!buckets.has(k)) buckets.set(k, { key: k, sales: [], expenses: [] })
    return buckets.get(k)
  }
  for (const s of sales) get(periodKey(s.date, granularity)).sales.push(s)
  for (const e of expenses) get(periodKey(e.date, granularity)).expenses.push(e)

  const keys = [...buckets.keys()].sort()
  if (keys.length === 0 && !(from && to)) return []
  const first = from ? periodKey(from, granularity) : keys[0]
  const last = to ? periodKey(to, granularity) : keys[keys.length - 1]

  const rows = []
  let k = first
  let guard = 0
  while (k <= last && guard++ < 5000) {
    const b = buckets.get(k) || { sales: [], expenses: [] }
    const sm = summarize(b.sales, b.expenses)
    rows.push({ key: k, ...sm })
    k = nextKey(k, granularity)
  }
  return rows
}

/** Add % change vs the previous row for sales and net profit. */
export function withChanges(rows) {
  return rows.map((r, i) => {
    const prev = rows[i - 1]
    return {
      ...r,
      salesChange: prev ? changePct(r.revenue, prev.revenue) : null,
      profitChange: prev ? changePct(r.netProfit, prev.netProfit) : null,
    }
  })
}

export function changePct(curr, prev) {
  if (!prev) return null // avoid division by zero
  return ((curr - prev) / Math.abs(prev)) * 100
}

/** Pick a sensible chart granularity for a span of days. */
export function autoGranularity(spanDays) {
  if (spanDays <= 62) return 'day'
  if (spanDays <= 365) return 'week'
  return 'month'
}

const nameKey = (s) => (s.productName || '').trim().toLowerCase()

export function productPerformance(sales) {
  const map = new Map()
  for (const s of sales) {
    const k = nameKey(s)
    if (!map.has(k)) {
      map.set(k, { name: s.productName, category: s.category, quantity: 0, revenue: 0, cogs: 0, profit: 0, count: 0 })
    }
    const p = map.get(k)
    p.quantity += s.quantity
    p.revenue += s.revenue
    p.cogs += s.cogs
    p.profit += s.grossProfit
    p.count += 1
  }
  return [...map.values()]
    .map((p) => ({
      ...p,
      quantity: Math.round(p.quantity * 1000) / 1000,
      revenue: round2(p.revenue),
      cogs: round2(p.cogs),
      profit: round2(p.profit),
      margin: pct(p.profit, p.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function categoryPerformance(sales) {
  const map = new Map()
  for (const s of sales) {
    const k = (s.category || 'Other').trim().toLowerCase()
    if (!map.has(k)) map.set(k, { category: s.category || 'Other', revenue: 0, profit: 0 })
    const c = map.get(k)
    c.revenue += s.revenue
    c.profit += s.grossProfit
  }
  const rows = [...map.values()].map((c) => ({ ...c, revenue: round2(c.revenue), profit: round2(c.profit) }))
  const totalRev = rows.reduce((a, c) => a + c.revenue, 0)
  const totalProfit = rows.reduce((a, c) => a + c.profit, 0)
  return rows
    .map((c) => ({
      ...c,
      revenueShare: pct(c.revenue, totalRev),
      profitShare: totalProfit > 0 ? (c.profit / totalProfit) * 100 : null,
      margin: pct(c.profit, c.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function spanDays(from, to) {
  return diffDays(to, from) + 1
}

export { monthKey }
