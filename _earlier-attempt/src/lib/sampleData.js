// Sample data for an imaginary small grocery shop in Afghanistan. All amounts are in AFN.
// Prices are ILLUSTRATIVE, not real market data. Every record is flagged `sample: true`
// so it can be removed later without touching the user's own records.
// Generation is deterministic (seeded) and relative to "today", so the data always looks recent.

import { addDays, parseISO } from './dates.js';
import { hasSampleData } from './ledger.js';
import { round2 } from './numbers.js';

const DAYS = 60;
const QUANTITY_SCALE = 4;

// id, name, category, cost, price, current stock, low-stock threshold, how often it sells (weight), typical quantities
const PRODUCTS = [
  ['rice', 'Rice (Sella), kg', 'Staples', 72, 85, 140, 25, 10, [1, 2, 3, 5, 10]],
  ['flour', 'Wheat flour, kg', 'Staples', 38, 45, 85, 25, 10, [2, 5, 10, 15]],
  ['sugar', 'Sugar, kg', 'Staples', 62, 72, 9, 15, 8, [1, 2, 3, 5]],
  ['oil', 'Cooking oil, 1 L', 'Cooking essentials', 180, 205, 6, 10, 7, [1, 2, 3]],
  ['salt', 'Salt, kg', 'Cooking essentials', 12, 20, 60, 10, 4, [1, 2]],
  ['chickpeas', 'Chickpeas, kg', 'Staples', 90, 110, 31, 10, 4, [1, 2, 3]],
  ['lentils', 'Mung beans, kg', 'Staples', 100, 120, 0, 10, 4, [1, 2, 3]],
  ['tea', 'Green tea, 250 g', 'Beverages', 110, 135, 24, 10, 6, [1, 2, 3]],
  ['water', 'Bottled water, 1.5 L', 'Beverages', 18, 30, 120, 24, 8, [1, 2, 6, 12]],
  ['eggs', 'Eggs, tray of 30', 'Dairy & eggs', 290, 340, 12, 6, 6, [1, 2]],
  ['yogurt', 'Yogurt, 1 kg', 'Dairy & eggs', 85, 110, 7, 8, 5, [1, 2, 3]],
  ['biscuits', 'Biscuits, pack', 'Snacks', 20, 30, 55, 20, 6, [1, 2, 4, 6]],
  ['soap', 'Laundry soap bar', 'Household', 25, 35, 44, 12, 3, [1, 2, 4]],
];

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSampleData(today) {
  const rand = mulberry32(20260101);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (min, max) => min + Math.floor(rand() * (max - min + 1));

  const products = PRODUCTS.map(([key, name, category, costPrice, sellingPrice, stock, lowStockThreshold]) => ({
    id: `sample_prod_${key}`,
    name,
    category,
    costPrice,
    sellingPrice,
    stock,
    lowStockThreshold,
    sample: true,
    createdAt: 0,
  }));

  const weighted = PRODUCTS.flatMap((p, i) => Array(p[7]).fill(i));
  const sales = [];
  const expenses = [];
  let seq = 0;

  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const dow = parseISO(date).getUTCDay();
    const isFriday = dow === 5; // quieter day in Afghanistan
    const entries = isFriday ? between(3, 5) : between(7, 11);
    for (let i = 0; i < entries; i += 1) {
      const index = pick(weighted);
      const [key, name, category, costPrice, sellingPrice, , , , quantities] = PRODUCTS[index];
      seq += 1;
      sales.push({
        id: `sample_sale_${seq}`,
        date,
        productId: `sample_prod_${key}`,
        productName: name,
        category,
        quantity: pick(quantities) * QUANTITY_SCALE, // each entry is a bulk or end-of-day batch
        sellingPrice,
        costPrice,
        sample: true,
        createdAt: seq,
      });
    }

    const day = Number(date.slice(8, 10));
    const addExpense = (category, description, amount) => {
      seq += 1;
      expenses.push({ id: `sample_exp_${seq}`, date, category, description, amount: round2(amount), sample: true, createdAt: seq });
    };
    if (day === 1) addExpense('rent', 'Shop rent', 10000);
    if (day === 1) addExpense('salaries', 'Shop assistant salary', 8000);
    if (day === 5) addExpense('electricity', 'Electricity bill', between(2400, 3300));
    if (offset % 6 === 2) addExpense('transport', 'Delivery of goods from wholesale market', between(500, 1200));
    if (offset % 11 === 4) addExpense('packaging', 'Plastic bags and wrapping', between(400, 800));
    if (offset % 17 === 7) addExpense('other', 'Cleaning supplies and small repairs', between(300, 1500));
  }

  return { products, sales, expenses };
}

/** Adds the sample records to the existing data. Does nothing if sample data is already loaded. */
export function loadSampleData(state, today) {
  if (hasSampleData(state)) return { ok: false, code: 'alreadyLoaded', state };
  const sample = buildSampleData(today);
  return {
    ok: true,
    state: {
      ...state,
      products: [...state.products, ...sample.products],
      sales: [...state.sales, ...sample.sales],
      expenses: [...state.expenses, ...sample.expenses],
    },
  };
}
