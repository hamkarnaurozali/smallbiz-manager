// Pure functions that change the app state (products, sales, expenses) and keep inventory consistent.
//
// Every function takes the current state and returns either
//   { ok: true, state: <new state>, ... }  or  { ok: false, errors: { field: { code, params } } }
// A failed call never changes anything (edits are all-or-nothing).
//
// Inventory rules
//  - Recording a sale linked to a product subtracts its quantity from stock.
//  - Editing a sale first returns the old quantity to stock, then applies the new one
//    (so only the real difference changes stock, and a product switch moves stock correctly).
//  - Deleting a sale returns its quantity to stock by default (it can be switched off by the caller).
//  - Deleting a product keeps its past sales (they keep the product name as text, unlinked).
//  - Editing a product's name/category updates the linked sales so reports stay grouped correctly;
//    prices on past sales are never changed.

import { hasAtMostDecimals, parseNumber, round3 } from './numbers.js';
import { isValidISO, todayISO } from './dates.js';

export const EXPENSE_CATEGORIES = ['rent', 'electricity', 'transport', 'salaries', 'packaging', 'other'];
export const DEFAULT_LOW_STOCK = 10;
export const STATE_VERSION = 1;

const MAX_MONEY = 1e9;
const MAX_QTY = 1e7;

export function emptyState() {
  return { version: STATE_VERSION, products: [], sales: [], expenses: [] };
}

let idCounter = 0;
export function newId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const err = (code, params) => ({ code, params });
const hasErrors = (errors) => Object.keys(errors).length > 0;

function readNumber(raw, { allowZero = false, max, decimals }) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return { error: err('err.required') };
  const n = parseNumber(raw);
  if (Number.isNaN(n)) return { error: err('err.number') };
  if (n < 0 || (!allowZero && n === 0)) return { error: err(allowZero ? 'err.negative' : 'err.positive') };
  if (decimals !== undefined && !hasAtMostDecimals(n, decimals)) return { error: err('err.decimals', { max: decimals }) };
  if (max !== undefined && n > max) return { error: err('err.tooLarge', { max }) };
  return { value: n };
}

function readDate(raw, today, errors) {
  const date = String(raw || '').trim();
  if (!date) errors.date = err('err.required');
  else if (!isValidISO(date)) errors.date = err('err.invalidDate');
  else if (date > today) errors.date = err('err.futureDate');
  return date;
}

/* ------------------------------------------------------------------ sales */

function readSaleFields(input, today) {
  const errors = {};
  const values = {};
  values.date = readDate(input.date, today, errors);
  values.productId = input.productId || '';
  values.productName = String(input.productName || '').trim();
  const q = readNumber(input.quantity, { max: MAX_QTY, decimals: 3 });
  if (q.error) errors.quantity = q.error;
  else values.quantity = q.value;
  const sp = readNumber(input.sellingPrice, { max: MAX_MONEY, decimals: 2 });
  if (sp.error) errors.sellingPrice = sp.error;
  else values.sellingPrice = sp.value;
  const cp = readNumber(input.costPrice, { allowZero: true, max: MAX_MONEY, decimals: 2 });
  if (cp.error) errors.costPrice = cp.error;
  else values.costPrice = cp.value;
  return { values, errors };
}

function adjustStock(products, productId, delta) {
  if (!productId) return products;
  return products.map((p) => (p.id === productId ? { ...p, stock: round3(Math.max(0, p.stock + delta)) } : p));
}

function buildSale(values, product, base = {}) {
  if (!values.productId && !values.productName) return null;
  return {
    ...base,
    date: values.date,
    productId: product ? product.id : null,
    productName: product ? product.name : values.productName,
    category: product ? product.category : '',
    quantity: values.quantity,
    sellingPrice: values.sellingPrice,
    costPrice: values.costPrice,
  };
}

function checkSaleAgainstStock(values, errors, products) {
  let product = null;
  if (values.productId) {
    product = products.find((p) => p.id === values.productId) || null;
    if (!product) errors.productId = err('err.productMissing');
  } else if (!values.productName) {
    errors.productName = err('err.required');
  } else if (values.productName.length > 80) {
    errors.productName = err('err.maxLength', { max: 80 });
  }
  if (product && !errors.quantity && values.quantity > product.stock) {
    errors.quantity = err('err.stock', { available: product.stock });
  }
  return product;
}

export function addSale(state, input, { today = todayISO(), now = Date.now() } = {}) {
  const { values, errors } = readSaleFields(input, today);
  const product = checkSaleAgainstStock(values, errors, state.products);
  if (hasErrors(errors)) return { ok: false, errors };
  const sale = buildSale(values, product, { id: newId('sale'), createdAt: now });
  return {
    ok: true,
    sale,
    state: {
      ...state,
      products: product ? adjustStock(state.products, product.id, -values.quantity) : state.products,
      sales: [...state.sales, sale],
    },
  };
}

export function updateSale(state, id, input, { today = todayISO() } = {}) {
  const old = state.sales.find((s) => s.id === id);
  if (!old) return { ok: false, errors: { _form: err('err.notFound') } };
  // Put the old quantity back first, then validate and apply the new one against that stock.
  const restored = adjustStock(state.products, old.productId, old.quantity);
  const { values, errors } = readSaleFields(input, today);
  const product = checkSaleAgainstStock(values, errors, restored);
  if (hasErrors(errors)) return { ok: false, errors };
  const sale = buildSale(values, product, { id: old.id, createdAt: old.createdAt, ...(old.sample ? { sample: true } : {}) });
  return {
    ok: true,
    sale,
    state: {
      ...state,
      products: product ? adjustStock(restored, product.id, -values.quantity) : restored,
      sales: state.sales.map((s) => (s.id === id ? sale : s)),
    },
  };
}

export function deleteSale(state, id, { restock = true } = {}) {
  const old = state.sales.find((s) => s.id === id);
  if (!old) return { ok: false, errors: { _form: err('err.notFound') } };
  return {
    ok: true,
    state: {
      ...state,
      products: restock ? adjustStock(state.products, old.productId, old.quantity) : state.products,
      sales: state.sales.filter((s) => s.id !== id),
    },
  };
}

/* --------------------------------------------------------------- products */

function readProductFields(input, products, selfId) {
  const errors = {};
  const values = {};
  values.name = String(input.name || '').trim();
  if (!values.name) errors.name = err('err.required');
  else if (values.name.length > 80) errors.name = err('err.maxLength', { max: 80 });
  else if (products.some((p) => p.id !== selfId && p.name.trim().toLowerCase() === values.name.toLowerCase())) {
    errors.name = err('err.duplicateProduct');
  }
  values.category = String(input.category || '').trim();
  if (!values.category) errors.category = err('err.required');
  else if (values.category.length > 40) errors.category = err('err.maxLength', { max: 40 });

  const cost = readNumber(input.costPrice, { allowZero: true, max: MAX_MONEY, decimals: 2 });
  if (cost.error) errors.costPrice = cost.error;
  else values.costPrice = cost.value;
  const price = readNumber(input.sellingPrice, { max: MAX_MONEY, decimals: 2 });
  if (price.error) errors.sellingPrice = price.error;
  else values.sellingPrice = price.value;
  const stock = readNumber(input.stock, { allowZero: true, max: MAX_QTY, decimals: 3 });
  if (stock.error) errors.stock = stock.error;
  else values.stock = stock.value;

  const raw = input.lowStockThreshold;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    values.lowStockThreshold = DEFAULT_LOW_STOCK;
  } else {
    const t = readNumber(raw, { allowZero: true, max: MAX_QTY, decimals: 3 });
    if (t.error) errors.lowStockThreshold = t.error;
    else values.lowStockThreshold = t.value;
  }
  return { values, errors };
}

export function addProduct(state, input, { now = Date.now() } = {}) {
  const { values, errors } = readProductFields(input, state.products, null);
  if (hasErrors(errors)) return { ok: false, errors };
  const product = { id: newId('prod'), ...values, createdAt: now };
  return { ok: true, product, state: { ...state, products: [...state.products, product] } };
}

export function updateProduct(state, id, input) {
  const old = state.products.find((p) => p.id === id);
  if (!old) return { ok: false, errors: { _form: err('err.notFound') } };
  const { values, errors } = readProductFields(input, state.products, id);
  if (hasErrors(errors)) return { ok: false, errors };
  const product = { ...old, ...values };
  return {
    ok: true,
    product,
    state: {
      ...state,
      products: state.products.map((p) => (p.id === id ? product : p)),
      // Keep linked sales grouped under the product's current name and category.
      sales: state.sales.map((s) => (s.productId === id ? { ...s, productName: product.name, category: product.category } : s)),
    },
  };
}

function unlinkSales(sales, productIds) {
  return sales.map((s) => (s.productId && productIds.has(s.productId) ? { ...s, productId: null } : s));
}

export function deleteProduct(state, id) {
  if (!state.products.some((p) => p.id === id)) return { ok: false, errors: { _form: err('err.notFound') } };
  return {
    ok: true,
    state: {
      ...state,
      products: state.products.filter((p) => p.id !== id),
      sales: unlinkSales(state.sales, new Set([id])),
    },
  };
}

/* --------------------------------------------------------------- expenses */

function readExpenseFields(input, today) {
  const errors = {};
  const values = {};
  values.date = readDate(input.date, today, errors);
  values.category = String(input.category || '');
  if (!EXPENSE_CATEGORIES.includes(values.category)) errors.category = err('err.required');
  values.description = String(input.description || '').trim();
  if (values.description.length > 120) errors.description = err('err.maxLength', { max: 120 });
  const amount = readNumber(input.amount, { max: MAX_MONEY, decimals: 2 });
  if (amount.error) errors.amount = amount.error;
  else values.amount = amount.value;
  return { values, errors };
}

export function addExpense(state, input, { today = todayISO(), now = Date.now() } = {}) {
  const { values, errors } = readExpenseFields(input, today);
  if (hasErrors(errors)) return { ok: false, errors };
  const expense = { id: newId('exp'), ...values, createdAt: now };
  return { ok: true, expense, state: { ...state, expenses: [...state.expenses, expense] } };
}

export function updateExpense(state, id, input, { today = todayISO() } = {}) {
  const old = state.expenses.find((e) => e.id === id);
  if (!old) return { ok: false, errors: { _form: err('err.notFound') } };
  const { values, errors } = readExpenseFields(input, today);
  if (hasErrors(errors)) return { ok: false, errors };
  const expense = { ...old, ...values };
  return { ok: true, expense, state: { ...state, expenses: state.expenses.map((e) => (e.id === id ? expense : e)) } };
}

export function deleteExpense(state, id) {
  if (!state.expenses.some((e) => e.id === id)) return { ok: false, errors: { _form: err('err.notFound') } };
  return { ok: true, state: { ...state, expenses: state.expenses.filter((e) => e.id !== id) } };
}

/* ------------------------------------------------------------ sample data */

export function hasSampleData(state) {
  return [...state.products, ...state.sales, ...state.expenses].some((r) => r.sample === true);
}

export function hasAnyData(state) {
  return state.products.length + state.sales.length + state.expenses.length > 0;
}

/** Removes only records flagged as sample data. Sales you entered yourself are kept (unlinked from sample products). */
export function removeSampleData(state) {
  const sampleProductIds = new Set(state.products.filter((p) => p.sample).map((p) => p.id));
  return {
    ...state,
    products: state.products.filter((p) => !p.sample),
    sales: unlinkSales(
      state.sales.filter((s) => !s.sample),
      sampleProductIds,
    ),
    expenses: state.expenses.filter((e) => !e.sample),
  };
}
