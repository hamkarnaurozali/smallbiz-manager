import { addDays, todayStr } from './dates.js'
import { round2, round3 } from './money.js'

// Realistic small-grocery data in AFN. Every record carries sample: true so it can be
// removed later without touching the user's own records. Generated fresh relative to
// "today" so the dashboard filters (today / 7 / 30 days) always have something to show.

const CATALOG = [
  // name, category, cost, sell, typical daily units, leftover stock, low-stock threshold
  ['Rice (1 kg)', 'Grains & Flour', 70, 85, 6, 40, 15],
  ['Wheat flour (10 kg)', 'Grains & Flour', 420, 480, 2, 14, 5],
  ['Cooking oil (1 L)', 'Oils & Staples', 150, 175, 5, 9, 12],
  ['Sugar (1 kg)', 'Oils & Staples', 62, 72, 5, 30, 12],
  ['Salt (1 kg)', 'Oils & Staples', 12, 20, 3, 25, 8],
  ['Green tea (100 g)', 'Beverages', 40, 55, 4, 22, 10],
  ['Black tea (200 g)', 'Beverages', 85, 110, 2, 3, 6],
  ['Lentils / mash (1 kg)', 'Pulses', 90, 110, 3, 18, 8],
  ['Chickpeas (1 kg)', 'Pulses', 95, 115, 2, 16, 8],
  ['Raisins (1 kg)', 'Dried fruit & nuts', 280, 340, 1, 7, 4],
  ['Eggs (tray of 30)', 'Dairy & Eggs', 270, 320, 2, 6, 5],
  ['Milk powder (400 g)', 'Dairy & Eggs', 260, 310, 1, 12, 4],
  ['Laundry soap', 'Household', 25, 35, 3, 0, 10],
  ['Biscuits (pack)', 'Snacks', 18, 25, 6, 45, 15],
]

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildSample(today = todayStr(), days = 60) {
  const rnd = mulberry32(20260101)
  const products = CATALOG.map(([name, category, costPrice, sellPrice, , , lowStockThreshold], i) => ({
    id: `sample-prod-${i + 1}`,
    name,
    category,
    costPrice,
    sellPrice,
    stock: 0,
    lowStockThreshold,
    sample: true,
  }))

  const sales = []
  let n = 0
  for (let d = days - 1; d >= 0; d--) {
    const date = addDays(today, -d)
    CATALOG.forEach(([, , costPrice, sellPrice, daily], i) => {
      const chance = Math.min(1, daily / 3)
      if (rnd() > 0.35 + chance * 0.5) return
      const quantity = Math.max(1, Math.round(daily * 1.6 * (0.5 + rnd())))
      const price = rnd() < 0.1 ? sellPrice - 5 : sellPrice // occasional small discount
      const revenue = round2(quantity * price)
      const cogs = round2(quantity * costPrice)
      const p = products[i]
      n += 1
      sales.push({
        id: `sample-sale-${n}`,
        date,
        productId: p.id,
        productName: p.name,
        category: p.category,
        quantity: round3(quantity),
        sellPrice: price,
        costPrice,
        revenue,
        cogs,
        grossProfit: round2(revenue - cogs),
        sample: true,
      })
    })
  }
  // Current stock levels (some deliberately low so the low-stock warning is visible).
  products.forEach((p, i) => {
    p.stock = round3(CATALOG[i][5])
  })

  const expenses = []
  let e = 0
  const add = (date, category, description, amount) => {
    if (date > today) return
    e += 1
    expenses.push({ id: `sample-exp-${e}`, date, category, description, amount, sample: true })
  }
  const base = new Date(today.slice(0, 4), Number(today.slice(5, 7)) - 1, 1)
  for (let m = 0; m < 3; m++) {
    const first = new Date(base.getFullYear(), base.getMonth() - m, 1)
    const iso = (day) => `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (iso(1) < addDays(today, -days)) continue
    add(iso(1), 'Rent', 'Shop rent', 8000)
    add(iso(3), 'Salaries', 'Helper salary', 6000)
    add(iso(5), 'Electricity', 'Electricity bill', 900 + Math.round(rnd() * 400))
    add(iso(10), 'Other', 'Phone credit and internet', 300)
  }
  for (let d = days - 1; d >= 0; d -= 7) {
    add(addDays(today, -d), 'Transport', 'Delivery from wholesale market', 400 + Math.round(rnd() * 300))
  }
  for (let d = days - 4; d >= 0; d -= 15) {
    add(addDays(today, -d), 'Packaging', 'Plastic bags and wrapping', 250 + Math.round(rnd() * 150))
  }

  return { products, sales, expenses }
}
