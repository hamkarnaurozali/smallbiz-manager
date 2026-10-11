import { describe, expect, it } from 'vitest';
import { parseNumber, round2 } from '../src/lib/numbers.js';
import { addDays, autoGranularity, enumerateBuckets, isValidISO, presetRange, previousRange, startOfWeek } from '../src/lib/dates.js';
import { categoryPerformance, margin, percentChange, productPerformance, summarize, timeSeries } from '../src/lib/finance.js';
import { formatMoney, formatPercent } from '../src/lib/format.js';
import { expensesToCsv, salesToCsv, toCsv } from '../src/lib/csv.js';
import { buildBackup, loadState, normalizeState, parseBackup, saveState, STORAGE_KEY } from '../src/lib/storage.js';
import { emptyState } from '../src/lib/ledger.js';
import { buildSampleData } from '../src/lib/sampleData.js';

describe('parseNumber', () => {
  it('accepts plain, decimal and thousands-grouped numbers', () => {
    expect(parseNumber('12')).toBe(12);
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber('1,200')).toBe(1200);
    expect(parseNumber(' 7 ')).toBe(7);
  });
  it('accepts Persian and Arabic-Indic digits', () => {
    expect(parseNumber('۱۲۰۰')).toBe(1200);
    expect(parseNumber('٣٫٥')).toBe(3.5);
  });
  it('rejects ambiguous or invalid input', () => {
    for (const bad of ['', 'abc', '12,5', '-5', '1e3', '1.2.3', '١٢,٥', null, undefined, NaN]) {
      expect(parseNumber(bad)).toBeNaN();
    }
  });
});

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(isValidISO('2026-02-28')).toBe(true);
    expect(isValidISO('2026-02-30')).toBe(false);
    expect(isValidISO('26-02-01')).toBe(false);
  });
  it('computes week starts (Saturday and Monday)', () => {
    expect(startOfWeek('2026-10-11', 6)).toBe('2026-10-10'); // Sunday -> previous Saturday
    expect(startOfWeek('2026-10-10', 6)).toBe('2026-10-10');
    expect(startOfWeek('2026-10-11', 1)).toBe('2026-10-05');
  });
  it('enumerates buckets', () => {
    expect(enumerateBuckets('2026-10-01', '2026-10-03', 'day')).toHaveLength(3);
    expect(enumerateBuckets('2026-09-15', '2026-11-02', 'month')).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
  });
  it('builds ranges', () => {
    expect(presetRange('7d', '2026-10-11')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(presetRange('30d', '2026-10-11').from).toBe('2026-09-12');
    expect(presetRange('all', '2026-10-11', ['2026-08-01', '2026-09-01'])).toEqual({ from: '2026-08-01', to: '2026-10-11' });
    expect(presetRange('all', '2026-10-11', [])).toEqual({ from: '2026-10-11', to: '2026-10-11' });
    expect(previousRange('2026-10-05', '2026-10-11')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(autoGranularity('2026-01-01', '2026-10-11')).toBe('month');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

const sales = [
  { id: 's1', date: '2026-10-09', productName: 'Rice', category: 'Staples', quantity: 10, sellingPrice: 85, costPrice: 72, productId: 'p1' },
  { id: 's2', date: '2026-10-10', productName: 'Oil', category: 'Cooking', quantity: 2, sellingPrice: 205, costPrice: 180, productId: 'p2' },
  { id: 's3', date: '2026-10-10', productName: 'rice', category: 'Staples', quantity: 5, sellingPrice: 85, costPrice: 72, productId: 'p1' },
];
const expenses = [
  { id: 'e1', date: '2026-10-10', category: 'rent', description: '', amount: 100 },
  { id: 'e2', date: '2026-10-09', category: 'transport', description: '', amount: 50 },
];

describe('finance', () => {
  it('summarises without subtracting product cost twice', () => {
    const s = summarize(sales, expenses);
    expect(s.revenue).toBe(1685); // 850 + 410 + 425
    expect(s.cogs).toBe(1440); // 720 + 360 + 360
    expect(s.grossProfit).toBe(245);
    expect(s.operatingExpenses).toBe(150);
    expect(s.netProfit).toBe(95);
    expect(s.salesCount).toBe(3);
    expect(s.grossMargin).toBeCloseTo((245 / 1685) * 100, 6);
    expect(s.netMargin).toBeCloseTo((95 / 1685) * 100, 6);
  });
  it('handles empty data and zero revenue without dividing by zero', () => {
    const s = summarize([], []);
    expect(s.revenue).toBe(0);
    expect(s.grossMargin).toBeNull();
    expect(s.netMargin).toBeNull();
    const onlyExpenses = summarize([], expenses);
    expect(onlyExpenses.netProfit).toBe(-150);
    expect(onlyExpenses.netMargin).toBeNull();
    expect(margin(10, 0)).toBeNull();
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(150, 100)).toBe(50);
    expect(formatPercent(null)).toBe('—');
  });
  it('time series buckets add up to the totals and include empty days', () => {
    const rows = timeSeries(sales, expenses, '2026-10-08', '2026-10-11', 'day');
    expect(rows.map((r) => r.key)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(rows[0].sales).toBe(0);
    const total = summarize(sales, expenses);
    expect(rows.reduce((a, r) => a + r.sales, 0)).toBe(total.revenue);
    expect(rows.reduce((a, r) => a + r.netProfit, 0)).toBeCloseTo(total.netProfit, 6);
    const monthly = timeSeries(sales, expenses, '2026-10-01', '2026-10-31', 'month');
    expect(monthly).toHaveLength(1);
    expect(monthly[0].count).toBe(3);
  });
  it('groups products case-insensitively and computes category shares', () => {
    const perf = productPerformance(sales);
    const rice = perf.find((p) => p.key === 'rice');
    expect(rice.units).toBe(15);
    expect(rice.revenue).toBe(1275);
    const cats = categoryPerformance(sales);
    expect(cats.find((c) => c.category === 'Staples').revenueShare).toBeCloseTo((1275 / 1685) * 100, 6);
    expect(cats.reduce((a, c) => a + c.revenueShare, 0)).toBeCloseTo(100, 6);
  });
  it('avoids floating point drift', () => {
    const s = summarize([{ date: '2026-10-10', quantity: 3, sellingPrice: 0.1, costPrice: 0.07, productName: 'x' }], []);
    expect(s.revenue).toBe(0.3);
    expect(s.cogs).toBe(0.21);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
  it('formats AFN consistently', () => {
    expect(formatMoney(12500)).toBe('AFN 12,500');
    expect(formatMoney(12500.5)).toBe('AFN 12,500.50');
    expect(formatMoney(-30)).toBe('-AFN 30');
    expect(formatMoney(NaN)).toBe('AFN 0');
  });
});

describe('csv', () => {
  it('writes BOM, CRLF, quoting and formula protection', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['=SUM(A1)', 5], ['line\nbreak', -3]]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('\r\n');
    expect(csv).toContain('"x,y","say ""hi"""');
    expect(csv).toContain("'=SUM(A1),5");
    expect(csv).toContain('"line\nbreak",-3');
  });
  it('exports sales with calculated columns and a sample flag', () => {
    const csv = salesToCsv(sales).replace('﻿', '').split('\r\n');
    expect(csv[0]).toBe('sale_id,date,product,category,quantity,unit_selling_price_afn,unit_cost_price_afn,revenue_afn,cogs_afn,gross_profit_afn,is_sample');
    expect(csv[1]).toBe('s1,2026-10-09,Rice,Staples,10,85,72,850,720,130,false');
    expect(csv).toHaveLength(5); // header + 3 rows + trailing blank
    expect(expensesToCsv(expenses).split('\r\n')[1]).toBe('e2,2026-10-09,transport,,50,false');
  });
});

describe('storage', () => {
  const memory = () => {
    const data = new Map();
    return {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => data.set(k, v),
      keys: () => [...data.keys()],
    };
  };
  it('round-trips state', () => {
    const storage = memory();
    const state = { ...emptyState(), expenses: [{ id: 'e1', date: '2026-10-09', category: 'rent', description: 'x', amount: 5 }] };
    expect(saveState(state, storage).ok).toBe(true);
    const loaded = loadState(storage);
    expect(loaded.notice).toBeNull();
    expect(loaded.state.expenses).toHaveLength(1);
  });
  it('keeps a backup copy of unreadable data instead of destroying it', () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, '{not json');
    const loaded = loadState(storage);
    expect(loaded.notice).toBe('corrupt');
    expect(storage.keys().some((k) => k.includes('backup'))).toBe(true);
  });
  it('skips invalid records and unlinks sales of missing products', () => {
    const result = normalizeState({
      products: [{ id: 'p1', name: 'Rice', category: 'Staples', costPrice: 1, sellingPrice: 2, stock: 3 }, { id: 'bad' }],
      sales: [
        { id: 's1', date: '2026-10-09', productId: 'gone', productName: 'Rice', quantity: 1, sellingPrice: 2, costPrice: 1 },
        { id: 's2', date: 'nope', productName: 'x', quantity: 1, sellingPrice: 1, costPrice: 1 },
      ],
      expenses: [{ id: 'e1', date: '2026-10-09', category: 'weird', amount: 10 }],
    });
    expect(result.dropped).toBe(2);
    expect(result.state.sales).toHaveLength(1);
    expect(result.state.sales[0].productId).toBeNull();
    expect(result.state.expenses[0].category).toBe('other');
  });
  it('round-trips a backup file and rejects garbage', () => {
    const sample = buildSampleData('2026-10-11');
    const state = { ...emptyState(), ...sample };
    const restored = parseBackup(buildBackup(state));
    expect(restored.ok).toBe(true);
    expect(restored.dropped).toBe(0);
    expect(restored.state.sales).toHaveLength(sample.sales.length);
    expect(parseBackup('hello').ok).toBe(false);
    expect(parseBackup('{"foo":1}').ok).toBe(false);
  });
});
