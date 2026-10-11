import { describe, expect, it } from 'vitest'
import * as S from '../lib/store.js'
import { summarize, groupByPeriod, productPerformance, categoryPerformance, rangeBounds, filterByDate, changePct } from '../lib/calc.js'
import { toCSV, SALES_COLUMNS } from '../lib/csv.js'
import { buildSample } from '../lib/sample.js'
import { loadState, saveState } from '../lib/storage.js'
import { addDays, todayStr } from '../lib/dates.js'

const today = todayStr()
const base = () => {
  let s = S.emptyState()
  s = S.addProduct(s, { name: 'Rice', category: 'Grains', costPrice: 70, sellPrice: 85, stock: 10 }).state
  return s
}
const sale = (s, over = {}) =>
  S.addSale(s, { date: today, productId: s.products[0].id, quantity: 3, sellPrice: 85, costPrice: 70, ...over })

describe('sale maths', () => {
  it('computes revenue, COGS, gross profit', () => {
    const { state } = sale(base())
    const x = state.sales[0]
    expect([x.revenue, x.cogs, x.grossProfit]).toEqual([255, 210, 45])
  })
  it('avoids floating-point drift', () => {
    const { state } = sale(base(), { quantity: 0.1, sellPrice: 3, costPrice: 1.1 })
    expect(state.sales[0].revenue).toBe(0.3)
    expect(state.sales[0].cogs).toBe(0.11)
  })
})

describe('validation', () => {
  const s = base()
  it.each([
    [{ quantity: 0 }, 'quantity'],
    [{ quantity: -2 }, 'quantity'],
    [{ quantity: 'abc' }, 'quantity'],
    [{ quantity: '' }, 'quantity'],
    [{ sellPrice: 0 }, 'sellPrice'],
    [{ costPrice: -1 }, 'costPrice'],
    [{ date: '' }, 'date'],
    [{ date: addDays(today, 3) }, 'date'],
    [{ date: '2026-02-31' }, 'date'],
  ])('rejects %j', (over, field) => {
    const r = sale(s, over)
    expect(r.errors[field]).toBeTruthy()
    expect(r.state).toBe(s)
  })
  it('requires a name for untracked product', () => {
    expect(S.addSale(s, { date: today, productId: null, productName: ' ', quantity: 1, sellPrice: 5, costPrice: 1 }).errors.productName).toBeTruthy()
  })
  it('rejects bad expenses and products', () => {
    expect(S.addExpense(s, { date: today, category: 'Rent', amount: 0 }).errors.amount).toBeTruthy()
    expect(S.addExpense(s, { date: today, category: '', amount: 5 }).errors.category).toBeTruthy()
    expect(S.addProduct(s, { name: 'rice', costPrice: 1, sellPrice: 2, stock: 1 }).errors.name).toBe('err.productExists')
    expect(S.addProduct(s, { name: 'X', costPrice: 1, sellPrice: 2, stock: -1 }).errors.stock).toBeTruthy()
  })
})

describe('inventory consistency', () => {
  it('reduces stock on sale and blocks overselling', () => {
    let { state } = sale(base())
    expect(state.products[0].stock).toBe(7)
    const r = sale(state, { quantity: 8 })
    expect(r.errors.quantity).toBe('err.stock')
    expect(r.state.products[0].stock).toBe(7)
    expect(r.state.sales).toHaveLength(1)
    state = sale(state, { quantity: 7 }).state
    expect(state.products[0].stock).toBe(0)
  })
  it('edit returns old quantity first, then applies new', () => {
    let { state } = sale(base()) // stock 7
    const id = state.sales[0].id
    state = S.updateSale(state, id, { date: today, productId: state.products[0].id, quantity: 10, sellPrice: 85, costPrice: 70 }).state
    expect(state.products[0].stock).toBe(0) // 10 total available -> 10 sold
    state = S.updateSale(state, id, { date: today, productId: state.products[0].id, quantity: 2, sellPrice: 90, costPrice: 70 }).state
    expect(state.products[0].stock).toBe(8)
    expect(state.sales[0].revenue).toBe(180)
  })
  it('edit beyond available stock is rejected and changes nothing', () => {
    let { state } = sale(base())
    const before = state
    const r = S.updateSale(state, state.sales[0].id, { date: today, productId: state.products[0].id, quantity: 11, sellPrice: 85, costPrice: 70 })
    expect(r.errors.quantity).toBe('err.stock')
    expect(r.state).toBe(before)
  })
  it('delete returns stock; repeated add/delete is stable', () => {
    let { state } = sale(base())
    state = S.deleteSale(state, state.sales[0].id).state
    expect(state.products[0].stock).toBe(10)
    for (let i = 0; i < 5; i++) {
      state = sale(state).state
      state = S.deleteSale(state, state.sales[0].id).state
    }
    expect(state.products[0].stock).toBe(10)
  })
  it('switching product on edit moves stock between products', () => {
    let state = S.addProduct(base(), { name: 'Sugar', costPrice: 60, sellPrice: 72, stock: 5 }).state
    const [rice, sugar] = state.products
    state = S.addSale(state, { date: today, productId: rice.id, quantity: 4, sellPrice: 85, costPrice: 70 }).state
    state = S.updateSale(state, state.sales[0].id, { date: today, productId: sugar.id, quantity: 2, sellPrice: 72, costPrice: 60 }).state
    expect(state.products.find((p) => p.id === rice.id).stock).toBe(10)
    expect(state.products.find((p) => p.id === sugar.id).stock).toBe(3)
    expect(state.sales[0].productName).toBe('Sugar')
  })
  it('untracked sales do not touch stock', () => {
    const s = base()
    const r = S.addSale(s, { date: today, productId: null, productName: 'Phone card', category: 'Other', quantity: 2, sellPrice: 100, costPrice: 90 })
    expect(r.state.products[0].stock).toBe(10)
    const d = S.deleteSale(r.state, r.state.sales[0].id)
    expect(d.state.products[0].stock).toBe(10)
  })
  it('deleting a product keeps past sales and does not restock anything', () => {
    let { state } = sale(base())
    state = S.deleteProduct(state, state.products[0].id).state
    expect(state.sales[0].productName).toBe('Rice')
    expect(state.sales[0].productId).toBeNull()
    state = S.deleteSale(state, state.sales[0].id).state
    expect(state.products).toHaveLength(0)
  })
  it('price edits do not rewrite past sales', () => {
    let { state } = sale(base())
    state = S.updateProduct(state, state.products[0].id, { ...state.products[0], sellPrice: 100 }).state
    expect(state.sales[0].sellPrice).toBe(85)
  })
})

describe('financial summary', () => {
  const sales = [
    { date: today, revenue: 1000, cogs: 600, grossProfit: 400, quantity: 1, productName: 'A', category: 'X' },
    { date: today, revenue: 500, cogs: 300, grossProfit: 200, quantity: 1, productName: 'B', category: 'Y' },
  ]
  const expenses = [{ date: today, amount: 250 }]
  it('uses gross - opex with no double counting', () => {
    const s = summarize(sales, expenses)
    expect(s).toMatchObject({ revenue: 1500, cogs: 900, grossProfit: 600, opex: 250, netProfit: 350, count: 2 })
    expect(s.grossMargin).toBeCloseTo(40)
    expect(s.netMargin).toBeCloseTo(23.333, 2)
  })
  it('handles empty data and zero revenue (no division by zero)', () => {
    const s = summarize([], [{ amount: 100 }])
    expect(s.netProfit).toBe(-100)
    expect(s.grossMargin).toBeNull()
    expect(s.netMargin).toBeNull()
    expect(changePct(5, 0)).toBeNull()
  })
  it('range filters', () => {
    const rows = [{ date: today }, { date: addDays(today, -6) }, { date: addDays(today, -7) }, { date: addDays(today, -29) }, { date: addDays(today, -30) }]
    const n = (r) => { const b = rangeBounds(r, today); return filterByDate(rows, b.from, b.to).length }
    expect([n('today'), n('7d'), n('30d'), n('all')]).toEqual([1, 2, 4, 5])
  })
  it('groups by day/week/month with gaps filled', () => {
    const rows = [
      { date: '2026-03-02', revenue: 100, cogs: 60, grossProfit: 40, quantity: 1 }, // Monday
      { date: '2026-03-08', revenue: 50, cogs: 30, grossProfit: 20, quantity: 1 }, // Sunday, same week
      { date: '2026-04-01', revenue: 10, cogs: 5, grossProfit: 5, quantity: 1 },
    ]
    const exp = [{ date: '2026-03-03', amount: 10 }]
    const wk = groupByPeriod(rows, exp, 'week')
    expect(wk[0]).toMatchObject({ key: '2026-03-02', revenue: 150, opex: 10, netProfit: 50 })
    expect(wk.length).toBe(5)
    const mo = groupByPeriod(rows, exp, 'month')
    expect(mo.map((m) => m.key)).toEqual(['2026-03-01', '2026-04-01'])
    expect(groupByPeriod(rows, [], 'day', '2026-03-01', '2026-03-03').map((d) => d.revenue)).toEqual([0, 100, 0])
    expect(groupByPeriod([], [], 'day')).toEqual([])
  })
  it('product & category performance are consistent with totals', () => {
    const p = productPerformance(sales)
    expect(p[0].name).toBe('A')
    const c = categoryPerformance(sales)
    expect(c.reduce((a, x) => a + x.revenueShare, 0)).toBeCloseTo(100)
    expect(c.reduce((a, x) => a + x.profit, 0)).toBe(600)
  })
})

describe('sample data & persistence', () => {
  it('sample is internally consistent and loads only once', () => {
    const sample = buildSample()
    expect(sample.sales.length).toBeGreaterThan(100)
    expect(sample.sales.every((x) => x.date <= today && x.revenue === Math.round(x.quantity * x.sellPrice * 100) / 100)).toBe(true)
    expect(sample.products.every((p) => p.stock >= 0)).toBe(true)
    let { state } = S.loadSample(S.emptyState(), sample)
    const again = S.loadSample(state, sample)
    expect(again.error).toBe('err.sampleLoaded')
    expect(again.state.sales).toHaveLength(sample.sales.length)
  })
  it('removeSample keeps user records and unlinks their sales', () => {
    let state = S.loadSample(S.emptyState(), buildSample()).state
    state = S.addProduct(state, { name: 'Mine', costPrice: 1, sellPrice: 2, stock: 3 }).state
    const mine = state.products.find((p) => p.name === 'Mine')
    state = S.addSale(state, { date: today, productId: mine.id, quantity: 1, sellPrice: 2, costPrice: 1 }).state
    state = S.addExpense(state, { date: today, category: 'Rent', amount: 5 }).state
    state = S.removeSample(state).state
    expect(state.products.map((p) => p.name)).toEqual(['Mine'])
    expect(state.sales).toHaveLength(1)
    expect(state.expenses).toHaveLength(1)
    expect(state.meta.sampleLoaded).toBe(false)
    expect(S.loadSample(state, buildSample()).error).toBeUndefined() // can be loaded again after removal
  })
  it('resetAll empties', () => {
    expect(S.resetAll().state).toEqual(S.emptyState())
  })
  it('round-trips through storage and survives corrupt data', () => {
    const mem = new Map()
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
    const state = S.loadSample(S.emptyState(), buildSample()).state
    expect(saveState(state, storage)).toBe(true)
    expect(loadState(storage)).toEqual(state)
    mem.set('smallbiz-manager.v1', '{not json')
    expect(loadState(storage)).toEqual(S.emptyState())
    mem.set('smallbiz-manager.v1', JSON.stringify({ products: [null, 5], sales: [{ id: 'x' }], expenses: 'no' }))
    expect(loadState(storage)).toEqual(S.emptyState())
    expect(saveState(state, { setItem() { throw new Error('quota') } })).toBe(false)
  })
})

describe('csv', () => {
  it('has BOM, CRLF, quoting and formula-injection guard', () => {
    const csv = toCSV([{ date: '2026-01-01', productName: 'Tea, "green"', category: '=SUM(A1)', quantity: 2, sellPrice: 5.5, costPrice: 3, revenue: 11, cogs: 6, grossProfit: 5 }], SALES_COLUMNS)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('\r\n')
    expect(csv).toContain('"Tea, ""green"""')
    expect(csv).toContain("'=SUM(A1)")
    expect(csv.split('\r\n')[0]).toContain('revenue_afn')
  })
  it('keeps Dari/Pashto text intact', () => {
    expect(toCSV([{ description: 'کرایه دوکان' }], [{ label: 'd', key: 'description' }])).toContain('کرایه دوکان')
  })
})
