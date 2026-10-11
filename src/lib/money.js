export const CURRENCY = 'AFN'

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
export const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatMoney(n) {
  const v = Number.isFinite(n) ? n : 0
  return `${nf.format(round2(v))} ${CURRENCY}`
}

export function formatNumber(n) {
  return nf.format(Number.isFinite(n) ? round3(n) : 0)
}

// Compact axis labels: 12.5k, 1.2M
export function formatCompact(n) {
  const a = Math.abs(n)
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}k`
  return String(Math.round(n))
}

export function formatPercent(p) {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—'
  return `${p.toFixed(1)}%`
}

export function formatChange(p) {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—'
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}
