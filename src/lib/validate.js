import { isValidDateStr, todayStr } from './dates.js'

// Validators return { errors, values }. Error values are i18n keys (see src/i18n/en.js).
const MAX = 1e9

function num(v) {
  if (v === '' || v === null || v === undefined) return NaN
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function checkDate(v, errors, allowFuture = false) {
  if (!v) errors.date = 'err.dateRequired'
  else if (!isValidDateStr(v)) errors.date = 'err.dateInvalid'
  else if (!allowFuture && v > todayStr()) errors.date = 'err.dateFuture'
}

export function validateProduct(input) {
  const errors = {}
  const name = String(input.name ?? '').trim()
  const category = String(input.category ?? '').trim() || 'Other'
  const costPrice = num(input.costPrice)
  const sellPrice = num(input.sellPrice)
  const stock = num(input.stock)
  const lowStockThreshold = input.lowStockThreshold === '' || input.lowStockThreshold == null ? 5 : num(input.lowStockThreshold)

  if (!name) errors.name = 'err.nameRequired'
  else if (name.length > 80) errors.name = 'err.nameLong'
  if (Number.isNaN(costPrice)) errors.costPrice = 'err.number'
  else if (costPrice < 0) errors.costPrice = 'err.negative'
  else if (costPrice > MAX) errors.costPrice = 'err.tooBig'
  if (Number.isNaN(sellPrice)) errors.sellPrice = 'err.number'
  else if (sellPrice <= 0) errors.sellPrice = 'err.pricePositive'
  else if (sellPrice > MAX) errors.sellPrice = 'err.tooBig'
  if (Number.isNaN(stock)) errors.stock = 'err.number'
  else if (stock < 0) errors.stock = 'err.negative'
  else if (stock > MAX) errors.stock = 'err.tooBig'
  if (Number.isNaN(lowStockThreshold)) errors.lowStockThreshold = 'err.number'
  else if (lowStockThreshold < 0) errors.lowStockThreshold = 'err.negative'

  return { errors, values: { name, category, costPrice, sellPrice, stock, lowStockThreshold } }
}

export function validateSale(input) {
  const errors = {}
  const date = String(input.date ?? '')
  const quantity = num(input.quantity)
  const sellPrice = num(input.sellPrice)
  const costPrice = num(input.costPrice)
  const productId = input.productId || null
  const productName = String(input.productName ?? '').trim()
  const category = String(input.category ?? '').trim() || 'Other'

  checkDate(date, errors)
  if (!productId && !productName) errors.productName = 'err.nameRequired'
  if (productName.length > 80) errors.productName = 'err.nameLong'
  if (Number.isNaN(quantity)) errors.quantity = 'err.number'
  else if (quantity <= 0) errors.quantity = 'err.qtyPositive'
  else if (quantity > MAX) errors.quantity = 'err.tooBig'
  if (Number.isNaN(sellPrice)) errors.sellPrice = 'err.number'
  else if (sellPrice <= 0) errors.sellPrice = 'err.pricePositive'
  else if (sellPrice > MAX) errors.sellPrice = 'err.tooBig'
  if (Number.isNaN(costPrice)) errors.costPrice = 'err.number'
  else if (costPrice < 0) errors.costPrice = 'err.negative'
  else if (costPrice > MAX) errors.costPrice = 'err.tooBig'

  return { errors, values: { date, productId, productName, category, quantity, sellPrice, costPrice } }
}

export function validateExpense(input) {
  const errors = {}
  const date = String(input.date ?? '')
  const category = String(input.category ?? '').trim()
  const description = String(input.description ?? '').trim()
  const amount = num(input.amount)

  checkDate(date, errors)
  if (!category) errors.category = 'err.categoryRequired'
  if (description.length > 200) errors.description = 'err.descLong'
  if (Number.isNaN(amount)) errors.amount = 'err.number'
  else if (amount <= 0) errors.amount = 'err.amountPositive'
  else if (amount > MAX) errors.amount = 'err.tooBig'

  return { errors, values: { date, category, description, amount } }
}

export const hasErrors = (errors) => Object.keys(errors).length > 0
