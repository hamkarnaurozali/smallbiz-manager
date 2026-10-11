// All financial formulas live here so every page uses exactly the same numbers.
//
//   Revenue            = Quantity x Selling price
//   Cost of goods sold = Quantity x Cost price
//   Gross profit       = Revenue - Cost of goods sold
//   Net profit         = Gross profit - Operating expenses
//
// Operating expenses (rent, salaries, ...) never include the purchase cost of goods for resale;
// that cost is counted once, through the cost price of each sale.

import { round2 } from './numbers.js';
import { bucketKey, bucketLabel, enumerateBuckets } from './dates.js';

export const saleRevenue = (s) => round2(s.quantity * s.sellingPrice);
export const saleCogs = (s) => round2(s.quantity * s.costPrice);
export const saleGrossProfit = (s) => round2(saleRevenue(s) - saleCogs(s));

/** profit / revenue x 100, or null when revenue is not above zero (never divides by zero). */
export function margin(profit, revenue) {
  return revenue > 0 ? (profit / revenue) * 100 : null;
}

/** Percentage change from previous to current; null when the previous value is zero. */
export function percentChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function filterByRange(records, from, to) {
  return records.filter((r) => r.date >= from && r.date <= to);
}

export function summarize(sales, expenses) {
  let revenue = 0;
  let cogs = 0;
  let units = 0;
  for (const s of sales) {
    revenue += saleRevenue(s);
    cogs += saleCogs(s);
    units += s.quantity;
  }
  const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  revenue = round2(revenue);
  cogs = round2(cogs);
  const grossProfit = round2(revenue - cogs);
  const opex = round2(operatingExpenses);
  const netProfit = round2(grossProfit - opex);
  return {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses: opex,
    netProfit,
    grossMargin: margin(grossProfit, revenue),
    netMargin: margin(netProfit, revenue),
    salesCount: sales.length,
    expenseCount: expenses.length,
    unitsSold: Math.round(units * 1000) / 1000,
  };
}

/** Totals per day / week / month, with empty periods included as zeros. */
export function timeSeries(sales, expenses, from, to, granularity, weekStart = 6) {
  const keys = enumerateBuckets(from, to, granularity, weekStart);
  const map = new Map(
    keys.map((key) => [
      key,
      { key, label: bucketLabel(key, granularity), sales: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, count: 0 },
    ]),
  );
  for (const s of sales) {
    if (s.date < from || s.date > to) continue;
    const b = map.get(bucketKey(s.date, granularity, weekStart));
    if (!b) continue;
    b.sales += saleRevenue(s);
    b.cogs += saleCogs(s);
    b.count += 1;
  }
  for (const e of expenses) {
    if (e.date < from || e.date > to) continue;
    const b = map.get(bucketKey(e.date, granularity, weekStart));
    if (b) b.expenses += e.amount;
  }
  return keys.map((key) => {
    const b = map.get(key);
    b.sales = round2(b.sales);
    b.cogs = round2(b.cogs);
    b.expenses = round2(b.expenses);
    b.grossProfit = round2(b.sales - b.cogs);
    b.netProfit = round2(b.grossProfit - b.expenses);
    return b;
  });
}

const nameKey = (name) => String(name).trim().toLowerCase();

/** Sales grouped by product name (case-insensitive). */
export function productPerformance(sales) {
  const map = new Map();
  for (const s of sales) {
    const key = nameKey(s.productName);
    let row = map.get(key);
    if (!row) {
      row = { key, name: s.productName, category: s.category, units: 0, revenue: 0, cogs: 0, count: 0, lastDate: '' };
      map.set(key, row);
    }
    if (s.date >= row.lastDate) {
      row.lastDate = s.date;
      row.name = s.productName;
      row.category = s.category;
    }
    row.units += s.quantity;
    row.revenue += saleRevenue(s);
    row.cogs += saleCogs(s);
    row.count += 1;
  }
  return [...map.values()].map((r) => {
    const revenue = round2(r.revenue);
    const cogs = round2(r.cogs);
    const grossProfit = round2(revenue - cogs);
    return {
      ...r,
      units: Math.round(r.units * 1000) / 1000,
      revenue,
      cogs,
      grossProfit,
      margin: margin(grossProfit, revenue),
    };
  });
}

/** Sales grouped by product category. Sales with no category are grouped under ''. */
export function categoryPerformance(sales) {
  const map = new Map();
  for (const s of sales) {
    const category = (s.category || '').trim();
    const key = category.toLowerCase();
    let row = map.get(key);
    if (!row) {
      row = { category, revenue: 0, cogs: 0, units: 0 };
      map.set(key, row);
    }
    row.revenue += saleRevenue(s);
    row.cogs += saleCogs(s);
    row.units += s.quantity;
  }
  const rows = [...map.values()].map((r) => {
    const revenue = round2(r.revenue);
    const grossProfit = round2(revenue - round2(r.cogs));
    return { category: r.category, revenue, grossProfit, units: Math.round(r.units * 1000) / 1000 };
  });
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
  const totalProfit = rows.reduce((a, r) => a + r.grossProfit, 0);
  return rows.map((r) => ({
    ...r,
    revenueShare: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : null,
    profitShare: totalProfit > 0 ? (r.grossProfit / totalProfit) * 100 : null,
  }));
}

/** Operating expenses grouped by category, largest first. */
export function expenseBreakdown(expenses) {
  const map = new Map();
  for (const e of expenses) map.set(e.category, (map.get(e.category) || 0) + e.amount);
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      share: total > 0 ? (amount / total) * 100 : null,
    }))
    .sort((a, b) => b.amount - a.amount);
}
