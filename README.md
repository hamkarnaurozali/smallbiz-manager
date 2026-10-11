# SmallBiz Manager

A simple profit manager for small shops in Afghanistan. Record sales, expenses and products, and see revenue, cost of goods sold, gross profit and an **estimated** net profit in AFN. React + Vite, data saved in the browser (LocalStorage). No backend, login or API keys.

## Run it

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
cd smallbiz-manager
npm install
npm run dev
```

Open the address printed in the terminal (normally **http://localhost:5173**) in Chrome, Edge, Firefox or Safari.

Other commands:

```bash
npm test            # unit tests (calculations, inventory rules, CSV, storage)
npm run build       # production build into dist/
npm run preview     # serve the production build at http://localhost:4173
```

## Project structure

```
index.html
package.json, vite.config.js
src/
  main.jsx, App.jsx            app shell + hash routing (#/sales ...)
  styles.css                   all styling (green accent, responsive)
  i18n/
    index.jsx                  language provider; how to add Dari / Pashto
    en.js                      every English string (keys are translated, not code)
  store/StoreContext.jsx       React state + LocalStorage persistence
  lib/
    store.js                   pure add/edit/delete rules incl. inventory consistency
    calc.js                    all financial formulas, grouping, product/category stats
    validate.js                input validation (returns i18n error keys)
    storage.js                 safe load/save with sanitising of corrupt data
    csv.js                     Excel-safe CSV (UTF-8 BOM, CRLF, quoting)
    sample.js                  sample grocery-shop generator (AFN)
    money.js, dates.js, constants.js, chartColors.js
  components/                  Layout, ui (modal, toast, fields...), charts
  pages/                       Dashboard, Sales, Expenses, Products, Reports, Settings
  test/                        vitest tests
_earlier-attempt/              leftovers of an earlier unfinished attempt; unused, safe to delete
```

## How to use

- **Products**: add each item with purchase cost, selling price, stock and a low-stock level. A warning shows when stock reaches that level.
- **Sales → Record sale**: pick a product (prices fill in, you can change them) or "Other product" for items you don't stock. Revenue, cost of goods sold and gross profit are calculated live. A sale cannot exceed available stock.
- **Expenses**: running costs (rent, electricity, transport, salaries, packaging, other). Don't enter the cost of the goods you sell: it is already counted in each sale.
- **Dashboard**: six key figures plus charts, filtered by today / 7 days / 30 days / all time. Everything updates immediately after any change.
- **Reports**: choose a date range and group by day, week or month; see margins, change versus the previous period, category and product contribution; export Sales, Expenses, Products and the period summary to CSV.
- **Settings**: load or remove sample data, or reset everything (each asks for confirmation).

## Formulas

- Revenue = quantity × selling price; COGS = quantity × cost price; Gross profit = revenue − COGS
- Net profit (estimate) = gross profit − operating expenses (COGS is never subtracted twice)
- Margins = profit ÷ revenue × 100, shown as "—" when revenue is zero

## Inventory rules

- Recording a sale reduces stock; overselling is blocked.
- Editing a sale first returns the old quantity, then applies the new one (also when the product changes).
- Deleting a sale returns its quantity to stock (treated as correcting an entry error, not a customer return).
- Each sale stores its own prices, so changing a product's price or deleting a product never changes past sales.

## Not included in v1

Returns, refunds, discounts after the sale, purchase-order tracking, multi-device sync, import/restore. Data lives only in the browser, so **export CSVs regularly as a backup**. The app records and summarises business performance; it makes no claim that using it raises profit.

## Using the data for research

CSV columns are plain, snake_case and in AFN (`date, product, category, quantity, selling_price_afn, cost_price_afn, revenue_afn, cogs_afn, gross_profit_afn`), and contain no personal data, so they load directly into Excel, pandas or R. The "summary" export gives one row per day/week/month for time-series work.

## Adding Dari or Pashto

Copy `src/i18n/en.js` to `fa.js` (or `ps.js`), translate the values, register it in `LANGUAGES` in `src/i18n/index.jsx` (with `dir: 'rtl'`). A language selector appears in Settings automatically and the page flips to right-to-left. Missing keys fall back to English.

## Tested

Unit tests (33): formulas incl. rounding and zero revenue, validation, stock on add/edit/delete/product switch/oversell, product deletion, sample load-once and removal, storage round-trip and corrupt data, CSV format (BOM, quoting, formula-injection guard, Dari text), period grouping, every UI string key exists.

Browser run (Chromium, desktop and 390px phone): empty-state, add product, form validation, sale with live calculation, oversell blocked, edit and delete with confirmation, stock correct after each, KPI figures, persistence after reload, sample load without duplicates, dashboard filters, charts render, CSV download (BOM + header), weekly/monthly grouping, remove sample keeps own records, reset, no horizontal overflow on phone, no console errors.
