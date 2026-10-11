// CSV that opens correctly in Excel/LibreOffice/Google Sheets: UTF-8 BOM, CRLF line endings,
// quoted fields, and a guard against spreadsheet formula injection in text cells.
function cell(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','))
  return '﻿' + [header, ...body].join('\r\n') + '\r\n'
}

export function downloadCSV(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const SALES_COLUMNS = [
  { label: 'date', key: 'date' },
  { label: 'product', key: 'productName' },
  { label: 'category', key: 'category' },
  { label: 'quantity', key: 'quantity' },
  { label: 'selling_price_afn', key: 'sellPrice' },
  { label: 'cost_price_afn', key: 'costPrice' },
  { label: 'revenue_afn', key: 'revenue' },
  { label: 'cogs_afn', key: 'cogs' },
  { label: 'gross_profit_afn', key: 'grossProfit' },
]

export const EXPENSE_COLUMNS = [
  { label: 'date', key: 'date' },
  { label: 'category', key: 'category' },
  { label: 'description', key: 'description' },
  { label: 'amount_afn', key: 'amount' },
]

export const PRODUCT_COLUMNS = [
  { label: 'product', key: 'name' },
  { label: 'category', key: 'category' },
  { label: 'cost_price_afn', key: 'costPrice' },
  { label: 'selling_price_afn', key: 'sellPrice' },
  { label: 'stock', key: 'stock' },
  { label: 'low_stock_threshold', key: 'lowStockThreshold' },
]

const r1 = (v) => (v === null || v === undefined ? '' : Math.round(v * 100) / 100)
export const SUMMARY_COLUMNS = [
  { label: 'period_start', key: 'key' },
  { label: 'sales_afn', key: 'revenue' },
  { label: 'cogs_afn', key: 'cogs' },
  { label: 'gross_profit_afn', key: 'grossProfit' },
  { label: 'operating_expenses_afn', key: 'opex' },
  { label: 'net_profit_afn', key: 'netProfit' },
  { label: 'gross_margin_pct', value: (r) => r1(r.grossMargin) },
  { label: 'net_margin_pct', value: (r) => r1(r.netMargin) },
  { label: 'transactions', key: 'count' },
]
