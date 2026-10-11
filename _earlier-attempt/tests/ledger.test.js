import { describe, expect, it } from 'vitest';
import {
  addExpense, addProduct, addSale, deleteExpense, deleteProduct, deleteSale, emptyState,
  hasSampleData, removeSampleData, updateExpense, updateProduct, updateSale,
} from '../src/lib/ledger.js';
import { loadSampleData } from '../src/lib/sampleData.js';
import { summarize } from '../src/lib/finance.js';

const TODAY = '2026-10-11';
const opts = { today: TODAY };

function withProducts() {
  let s = emptyState();
  s = addProduct(s, { name: 'Rice', category: 'Staples', costPrice: '72', sellingPrice: '85', stock: '100', lowStockThreshold: '' }).state;
  s = addProduct(s, { name: 'Oil', category: 'Cooking', costPrice: '180', sellingPrice: '205', stock: '10' }).state;
  return s;
}
const stockOf = (s, name) => s.products.find((p) => p.name === name).stock;
const sale = (productId, quantity, extra = {}) => ({ date: '2026-10-10', productId, quantity: String(quantity), sellingPrice: '85', costPrice: '72', ...extra });

describe('products', () => {
  it('validates and rejects duplicates', () => {
    const s = withProducts();
    expect(s.products[0].lowStockThreshold).toBe(10);
    const dup = addProduct(s, { name: ' rice ', category: 'x', costPrice: '1', sellingPrice: '2', stock: '1' });
    expect(dup.errors.name.code).toBe('err.duplicateProduct');
    const bad = addProduct(s, { name: '', category: '', costPrice: '-1', sellingPrice: '0', stock: 'abc' });
    expect(Object.keys(bad.errors).sort()).toEqual(['category', 'costPrice', 'name', 'sellingPrice', 'stock']);
  });
  it('renaming a product updates linked sales but not their prices', () => {
    let s = withProducts();
    const rice = s.products[0];
    s = addSale(s, sale(rice.id, 5), opts).state;
    s = updateProduct(s, rice.id, { name: 'Rice Sella', category: 'Grains', costPrice: '99', sellingPrice: '120', stock: '95' }).state;
    expect(s.sales[0].productName).toBe('Rice Sella');
    expect(s.sales[0].category).toBe('Grains');
    expect(s.sales[0].sellingPrice).toBe(85);
    expect(s.sales[0].costPrice).toBe(72);
  });
  it('deleting a product keeps its sales as text records', () => {
    let s = withProducts();
    const rice = s.products[0];
    s = addSale(s, sale(rice.id, 5), opts).state;
    const before = summarize(s.sales, []);
    s = deleteProduct(s, rice.id).state;
    expect(s.products).toHaveLength(1);
    expect(s.sales[0].productId).toBeNull();
    expect(s.sales[0].productName).toBe('Rice');
    expect(summarize(s.sales, [])).toEqual(before);
  });
});

describe('sales and stock', () => {
  it('records a sale, computes totals and reduces stock', () => {
    let s = withProducts();
    const r = addSale(s, sale(s.products[0].id, '12.5'), opts);
    expect(r.ok).toBe(true);
    expect(stockOf(r.state, 'Rice')).toBe(87.5);
    expect(summarize(r.state.sales, []).grossProfit).toBe(162.5);
  });
  it('prevents selling more than available stock and changes nothing', () => {
    const s = withProducts();
    const r = addSale(s, sale(s.products[1].id, 11), opts);
    expect(r.ok).toBe(false);
    expect(r.errors.quantity).toEqual({ code: 'err.stock', params: { available: 10 } });
    expect(addSale(s, sale(s.products[1].id, 10), opts).ok).toBe(true);
  });
  it('validates quantity, prices, dates and names', () => {
    const s = withProducts();
    const r = addSale(s, { date: '2026-10-12', productId: '', productName: '', quantity: '0', sellingPrice: '-1', costPrice: 'x' }, opts);
    expect(Object.keys(r.errors).sort()).toEqual(['costPrice', 'date', 'productName', 'quantity', 'sellingPrice']);
    expect(r.errors.date.code).toBe('err.futureDate');
    expect(addSale(s, { ...sale('', 1), productName: 'Custom item', quantity: '2.3333' }, opts).errors.quantity.code).toBe('err.decimals');
  });
  it('allows items outside inventory without touching stock', () => {
    const s = withProducts();
    const r = addSale(s, { date: TODAY, productId: '', productName: 'Phone card', quantity: '3', sellingPrice: '100', costPrice: '0' }, opts);
    expect(r.ok).toBe(true);
    expect(r.state.products).toEqual(s.products);
  });
  it('editing a quantity only changes stock by the difference', () => {
    let s = withProducts();
    const id = s.products[0].id;
    s = addSale(s, sale(id, 10), opts).state;
    expect(stockOf(s, 'Rice')).toBe(90);
    s = updateSale(s, s.sales[0].id, sale(id, 4), opts).state;
    expect(stockOf(s, 'Rice')).toBe(96);
    s = updateSale(s, s.sales[0].id, sale(id, 100), opts).state; // exactly all stock that exists after restoring
    expect(stockOf(s, 'Rice')).toBe(0);
    expect(updateSale(s, s.sales[0].id, sale(id, 101), opts).ok).toBe(false);
  });
  it('a failed edit leaves everything unchanged', () => {
    let s = withProducts();
    const id = s.products[0].id;
    s = addSale(s, sale(id, 10), opts).state;
    const r = updateSale(s, s.sales[0].id, sale(id, 500), opts);
    expect(r.ok).toBe(false);
    expect(stockOf(s, 'Rice')).toBe(90);
    expect(s.sales[0].quantity).toBe(10);
  });
  it('switching product moves stock between the two products', () => {
    let s = withProducts();
    const [rice, oil] = s.products;
    s = addSale(s, sale(rice.id, 10), opts).state;
    s = updateSale(s, s.sales[0].id, sale(oil.id, 3, { sellingPrice: '205', costPrice: '180' }), opts).state;
    expect(stockOf(s, 'Rice')).toBe(100);
    expect(stockOf(s, 'Oil')).toBe(7);
    expect(s.sales[0].productName).toBe('Oil');
  });
  it('deleting a sale returns stock by default, or leaves it when asked', () => {
    let s = withProducts();
    const id = s.products[0].id;
    s = addSale(s, sale(id, 10), opts).state;
    s = addSale(s, sale(id, 20), opts).state;
    expect(stockOf(s, 'Rice')).toBe(70);
    const restocked = deleteSale(s, s.sales[0].id).state;
    expect(stockOf(restocked, 'Rice')).toBe(80);
    expect(restocked.sales).toHaveLength(1);
    const kept = deleteSale(s, s.sales[1].id, { restock: false }).state;
    expect(stockOf(kept, 'Rice')).toBe(70);
  });
  it('editing a sale whose product was deleted works as a plain record', () => {
    let s = withProducts();
    const id = s.products[0].id;
    s = addSale(s, sale(id, 10), opts).state;
    s = deleteProduct(s, id).state;
    const r = updateSale(s, s.sales[0].id, { date: TODAY, productId: '', productName: 'Rice', quantity: '4', sellingPrice: '90', costPrice: '70' }, opts);
    expect(r.ok).toBe(true);
    expect(r.state.sales[0].quantity).toBe(4);
  });
  it('stock never drifts or goes negative over many operations', () => {
    let s = withProducts();
    const id = s.products[0].id;
    for (let i = 0; i < 20; i += 1) s = addSale(s, sale(id, '0.1'), opts).state;
    expect(stockOf(s, 'Rice')).toBe(98);
    for (const x of [...s.sales]) s = deleteSale(s, x.id).state;
    expect(stockOf(s, 'Rice')).toBe(100);
  });
});

describe('expenses', () => {
  it('adds, edits and deletes with validation', () => {
    let s = emptyState();
    expect(addExpense(s, { date: TODAY, category: 'nope', description: '', amount: '5' }, opts).errors.category).toBeTruthy();
    expect(addExpense(s, { date: TODAY, category: 'rent', description: '', amount: '0' }, opts).errors.amount.code).toBe('err.positive');
    s = addExpense(s, { date: TODAY, category: 'rent', description: ' Shop ', amount: '15,000' }, opts).state;
    expect(s.expenses[0]).toMatchObject({ description: 'Shop', amount: 15000 });
    s = updateExpense(s, s.expenses[0].id, { date: TODAY, category: 'transport', description: 'x', amount: '300.5' }, opts).state;
    expect(s.expenses[0]).toMatchObject({ category: 'transport', amount: 300.5 });
    s = deleteExpense(s, s.expenses[0].id).state;
    expect(s.expenses).toHaveLength(0);
  });
});

describe('sample data', () => {
  it('loads once only and is consistent', () => {
    const first = loadSampleData(emptyState(), TODAY);
    expect(first.ok).toBe(true);
    expect(hasSampleData(first.state)).toBe(true);
    const again = loadSampleData(first.state, TODAY);
    expect(again.ok).toBe(false);
    expect(again.state.sales).toHaveLength(first.state.sales.length);
    const { products, sales, expenses } = first.state;
    expect(products.length).toBeGreaterThan(10);
    expect(sales.length).toBeGreaterThan(300);
    expect(new Set(sales.map((x) => x.id)).size).toBe(sales.length);
    expect(sales.every((x) => x.date <= TODAY && x.quantity > 0 && products.some((p) => p.id === x.productId))).toBe(true);
    expect(expenses.every((x) => x.date <= TODAY && x.amount > 0)).toBe(true);
    const sum = summarize(sales, expenses);
    expect(sum.grossProfit).toBeGreaterThan(0);
    expect(sum.netProfit).toBeGreaterThan(0); // a plausible, slightly profitable shop
    expect(sum.grossMargin).toBeGreaterThan(5);
    expect(sum.grossMargin).toBeLessThan(40);
  });
  it('removing sample data keeps the user\'s own records', () => {
    let s = withProducts();
    s = addSale(s, sale(s.products[0].id, 5), opts).state;
    s = addExpense(s, { date: TODAY, category: 'rent', description: 'mine', amount: '100' }, opts).state;
    s = loadSampleData(s, TODAY).state;
    // the user records a sale against a sample product
    const sampleRice = s.products.find((p) => p.sample);
    s = addSale(s, sale(sampleRice.id, 1, { productName: 'ignored' }), opts).state;
    const cleaned = removeSampleData(s);
    expect(hasSampleData(cleaned)).toBe(false);
    expect(cleaned.products.map((p) => p.name)).toEqual(['Rice', 'Oil']);
    expect(cleaned.sales).toHaveLength(2);
    expect(cleaned.sales.every((x) => x.productId === null || cleaned.products.some((p) => p.id === x.productId))).toBe(true);
    expect(cleaned.expenses).toHaveLength(1);
    // sample data can be loaded again after removal
    expect(loadSampleData(cleaned, TODAY).ok).toBe(true);
  });
});
