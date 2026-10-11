import { round2, round3 } from './money.js'
import { validateProduct, validateSale, validateExpense, hasErrors } from './validate.js'

/**
 * Pure state transitions. Every function takes the current state and returns
 * { state, error?, errors? } - it never mutates its input. That makes the
 * calculation and inventory rules easy to test (see src/test).
 *
 * INVENTORY RULES
 *  - A sale linked to a product reduces that product's stock by the quantity sold.
 *  - Editing a sale first RETURNS the old quantity to the old product, then applies the new
 *    sale (possibly to a different product). Net stock change is always consistent.
 *  - Deleting a sale returns its quantity to stock (it is treated as an entry error being
 *    corrected, not as a customer return or refund - those are not tracked in v1).
 *  - A sale can never exceed available stock. Sales of products not in inventory
 *    ("other product") are recorded without touching stock.
 *  - Editing a product's prices never rewrites past sales: each sale stores its own price and
 *    cost snapshot. Deleting a product keeps its past sales (name/category snapshot) intact.
 */

export const STORAGE_VERSION = 1

export const emptyState = () => ({
  version: STORAGE_VERSION,
  products: [],
  sales: [],
  expenses: [],
  meta: { sampleLoaded: false },
})

let counter = 0
export function newId(prefix = 'id') {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function buildSale(values, id, extra = {}) {
  const revenue = round2(values.quantity * values.sellPrice)
  const cogs = round2(values.quantity * values.costPrice)
  return {
    id,
    date: values.date,
    productId: values.productId,
    productName: values.productName,
    category: values.category,
    quantity: round3(values.quantity),
    sellPrice: values.sellPrice,
    costPrice: values.costPrice,
    revenue,
    cogs,
    grossProfit: round2(revenue - cogs),
    ...extra,
  }
}

const findProduct = (state, id) => state.products.find((p) => p.id === id)

/* ------------------------------ products ------------------------------ */

export function addProduct(state, input) {
  const { errors, values } = validateProduct(input)
  if (hasErrors(errors)) return { state, errors }
  const dup = state.products.find((p) => p.name.toLowerCase() === values.name.toLowerCase())
  if (dup) return { state, errors: { name: 'err.productExists' } }
  const product = { id: newId('prod'), ...values, stock: round3(values.stock) }
  return { state: { ...state, products: [...state.products, product] } }
}

export function updateProduct(state, id, input) {
  const existing = findProduct(state, id)
  if (!existing) return { state, error: 'err.notFound' }
  const { errors, values } = validateProduct(input)
  if (hasErrors(errors)) return { state, errors }
  const dup = state.products.find((p) => p.id !== id && p.name.toLowerCase() === values.name.toLowerCase())
  if (dup) return { state, errors: { name: 'err.productExists' } }
  const updated = { ...existing, ...values, stock: round3(values.stock) }
  return { state: { ...state, products: state.products.map((p) => (p.id === id ? updated : p)) } }
}

export function deleteProduct(state, id) {
  if (!findProduct(state, id)) return { state, error: 'err.notFound' }
  return {
    state: {
      ...state,
      products: state.products.filter((p) => p.id !== id),
      // Past sales keep their snapshot (name, category, prices) but are no longer linked.
      sales: state.sales.map((s) => (s.productId === id ? { ...s, productId: null } : s)),
    },
  }
}

/* -------------------------------- sales -------------------------------- */

/** Stock available to a sale, given the sale being replaced (if editing). */
export function availableStock(state, productId, editingSaleId = null) {
  const product = findProduct(state, productId)
  if (!product) return null
  const old = editingSaleId ? state.sales.find((s) => s.id === editingSaleId) : null
  const returned = old && old.productId === productId ? old.quantity : 0
  return round3(product.stock + returned)
}

function resolveSaleInput(state, input) {
  // When linked to a product, name/category come from the product snapshot.
  if (input.productId) {
    const p = findProduct(state, input.productId)
    if (!p) return { ...input, productId: null }
    return { ...input, productName: p.name, category: p.category }
  }
  return input
}

export function addSale(state, input, extra = {}) {
  const resolved = resolveSaleInput(state, input)
  const { errors, values } = validateSale(resolved)
  if (hasErrors(errors)) return { state, errors }
  let products = state.products
  if (values.productId) {
    const avail = availableStock(state, values.productId)
    if (values.quantity > avail) return { state, errors: { quantity: 'err.stock' }, stockLeft: avail }
    products = products.map((p) => (p.id === values.productId ? { ...p, stock: round3(p.stock - values.quantity) } : p))
  }
  const sale = buildSale(values, newId('sale'), extra)
  return { state: { ...state, products, sales: [...state.sales, sale] } }
}

export function updateSale(state, id, input) {
  const old = state.sales.find((s) => s.id === id)
  if (!old) return { state, error: 'err.notFound' }
  const resolved = resolveSaleInput(state, input)
  const { errors, values } = validateSale(resolved)
  if (hasErrors(errors)) return { state, errors }

  // 1) return old quantity to old product
  let products = state.products.map((p) => (old.productId && p.id === old.productId ? { ...p, stock: round3(p.stock + old.quantity) } : p))
  // 2) check + apply the new quantity
  if (values.productId) {
    const target = products.find((p) => p.id === values.productId)
    if (values.quantity > target.stock) {
      return { state, errors: { quantity: 'err.stock' }, stockLeft: availableStock(state, values.productId, id) }
    }
    products = products.map((p) => (p.id === values.productId ? { ...p, stock: round3(p.stock - values.quantity) } : p))
  }
  const sale = buildSale(values, id, old.sample ? { sample: true } : {})
  return { state: { ...state, products, sales: state.sales.map((s) => (s.id === id ? sale : s)) } }
}

export function deleteSale(state, id) {
  const old = state.sales.find((s) => s.id === id)
  if (!old) return { state, error: 'err.notFound' }
  const products = state.products.map((p) => (old.productId && p.id === old.productId ? { ...p, stock: round3(p.stock + old.quantity) } : p))
  return { state: { ...state, products, sales: state.sales.filter((s) => s.id !== id) } }
}

/* ------------------------------ expenses ------------------------------ */

export function addExpense(state, input, extra = {}) {
  const { errors, values } = validateExpense(input)
  if (hasErrors(errors)) return { state, errors }
  return { state: { ...state, expenses: [...state.expenses, { id: newId('exp'), ...values, ...extra }] } }
}

export function updateExpense(state, id, input) {
  const old = state.expenses.find((e) => e.id === id)
  if (!old) return { state, error: 'err.notFound' }
  const { errors, values } = validateExpense(input)
  if (hasErrors(errors)) return { state, errors }
  return { state: { ...state, expenses: state.expenses.map((e) => (e.id === id ? { ...old, ...values } : e)) } }
}

export function deleteExpense(state, id) {
  if (!state.expenses.some((e) => e.id === id)) return { state, error: 'err.notFound' }
  return { state: { ...state, expenses: state.expenses.filter((e) => e.id !== id) } }
}

/* --------------------------- sample / reset --------------------------- */

export function loadSample(state, sample) {
  // Never load twice: guards against duplicate sample records.
  if (state.meta.sampleLoaded || hasSample(state)) return { state, error: 'err.sampleLoaded' }
  return {
    state: {
      ...state,
      products: [...state.products, ...sample.products],
      sales: [...state.sales, ...sample.sales],
      expenses: [...state.expenses, ...sample.expenses],
      meta: { ...state.meta, sampleLoaded: true },
    },
  }
}

export const hasSample = (state) =>
  state.products.some((p) => p.sample) || state.sales.some((s) => s.sample) || state.expenses.some((e) => e.sample)

/** Removes only records flagged as sample; the user's own records are kept. */
export function removeSample(state) {
  const products = state.products.filter((p) => !p.sample)
  const ids = new Set(products.map((p) => p.id))
  return {
    state: {
      ...state,
      products,
      sales: state.sales.filter((s) => !s.sample).map((s) => (s.productId && !ids.has(s.productId) ? { ...s, productId: null } : s)),
      expenses: state.expenses.filter((e) => !e.sample),
      meta: { ...state.meta, sampleLoaded: false },
    },
  }
}

export const resetAll = () => ({ state: emptyState() })
