import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { COLORS } from '../lib/chartColors.js'
import { formatCompact, formatMoney } from '../lib/money.js'
import { monthLabel, shortDate } from '../lib/dates.js'

export function periodLabel(key, granularity) {
  if (granularity === 'month') return monthLabel(key.slice(0, 7))
  return shortDate(key)
}

const axisProps = { tick: { fill: COLORS.axis, fontSize: 12 }, tickLine: false, axisLine: { stroke: COLORS.grid } }

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tip-row">
          <span className="swatch" style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{formatMoney(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export function SalesExpensesChart({ rows, granularity, labels }) {
  const data = rows.map((r) => ({ label: periodLabel(r.key, granularity), sales: r.revenue, expenses: r.opex }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} tickFormatter={formatCompact} width={48} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="sales" name={labels.sales} fill={COLORS.sales} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expenses" name={labels.expenses} fill={COLORS.expenses} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ProfitChart({ rows, granularity, labels }) {
  const data = rows.map((r) => ({ label: periodLabel(r.key, granularity), gross: r.grossProfit, net: r.netProfit }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...axisProps} tickFormatter={formatCompact} width={48} />
        <Tooltip content={<MoneyTooltip />} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 13 }} />
        <Line dataKey="gross" name={labels.gross} stroke={COLORS.gross} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
        <Line dataKey="net" name={labels.net} stroke={COLORS.profit} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function TopProductsChart({ products, label }) {
  const data = products.map((p) => ({ name: p.name, revenue: p.revenue }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={formatCompact} />
        <YAxis type="category" dataKey="name" {...axisProps} width={130} tickFormatter={(v) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
        <Bar dataKey="revenue" name={label} fill={COLORS.sales} radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}
