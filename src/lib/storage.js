import { emptyState, STORAGE_VERSION } from './store.js'
import { isValidDateStr } from './dates.js'

export const STORAGE_KEY = 'smallbiz-manager.v1'

const isNum = (n) => typeof n === 'number' && Number.isFinite(n)

// Drop anything malformed so a corrupted/edited LocalStorage entry can't crash the app.
function sanitize(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  const products = (Array.isArray(raw.products) ? raw.products : []).filter(
    (p) => p && typeof p.id === 'string' && typeof p.name === 'string' && isNum(p.costPrice) && isNum(p.sellPrice) && isNum(p.stock),
  ).map((p) => ({ ...p, category: p.category || 'Other', lowStockThreshold: isNum(p.lowStockThreshold) ? p.lowStockThreshold : 5 }))
  const sales = (Array.isArray(raw.sales) ? raw.sales : []).filter(
    (s) => s && typeof s.id === 'string' && isValidDateStr(s.date) && isNum(s.quantity) && isNum(s.revenue) && isNum(s.cogs) && isNum(s.grossProfit),
  )
  const expenses = (Array.isArray(raw.expenses) ? raw.expenses : []).filter(
    (e) => e && typeof e.id === 'string' && isValidDateStr(e.date) && isNum(e.amount),
  )
  return {
    version: STORAGE_VERSION,
    products,
    sales,
    expenses,
    meta: { sampleLoaded: !!(raw.meta && raw.meta.sampleLoaded) },
  }
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const text = storage.getItem(STORAGE_KEY)
    if (!text) return emptyState()
    return sanitize(JSON.parse(text))
  } catch {
    return emptyState()
  }
}

/** Returns true on success, false if the browser refused (private mode, quota full...). */
export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
