import { useMemo, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { useT } from '../i18n/index.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { EmptyState, Notice, PageHeader, Segmented, StatCard, useToast } from '../components/ui.jsx'
import { SalesExpensesChart, periodLabel } from '../components/charts.jsx'
import { categoryPerformance, filterByDate, groupByPeriod, productPerformance, summarize, withChanges } from '../lib/calc.js'
import { EXPENSE_COLUMNS, PRODUCT_COLUMNS, SALES_COLUMNS, SUMMARY_COLUMNS, downloadCSV, toCSV } from '../lib/csv.js'
import { formatChange, formatMoney, formatNumber, formatPercent } from '../lib/money.js'
import { addDays, monthStart, todayStr } from '../lib/dates.js'

export default function Reports() {
  const t = useT()
  const toast = useToast()
  const { state } = useStore()
  const today = todayStr()
  const [from, setFrom] = useState(addDays(today, -29))
  const [to, setTo] = useState(today)
  const [g, setG] = useState('day')

  const invalid = !!(from && to && from > to)
  const data = useMemo(() => {
    if (invalid) return null
    const sales = filterByDate(state.sales, from || null, to || null)
    const expenses = filterByDate(state.expenses, from || null, to || null)
    const periods = withChanges(groupByPeriod(sales, expenses, g, from || null, to || null))
    return { sales, expenses, sum: summarize(sales, expenses), periods, products: productPerformance(sales), cats: categoryPerformance(sales) }
  }, [state.sales, state.expenses, from, to, g, invalid])

  const preset = (p) => {
    if (p === 'all') { setFrom(''); setTo('') }
    else if (p === 'month') { setFrom(monthStart(today)); setTo(today) }
    else { setFrom(addDays(today, -(p - 1))); setTo(today) }
  }

  const tag = `${from || 'start'}_to_${to || 'end'}`
  const exportCsv = (kind) => {
    if (!data) return
    const map = {
      sales: [`smallbiz-sales_${tag}.csv`, data.sales, SALES_COLUMNS],
      expenses: [`smallbiz-expenses_${tag}.csv`, data.expenses, EXPENSE_COLUMNS],
      products: [`smallbiz-products_${today}.csv`, state.products, PRODUCT_COLUMNS],
      summary: [`smallbiz-summary-by-${g}_${tag}.csv`, data.periods, SUMMARY_COLUMNS],
    }
    const [name, rows, cols] = map[kind]
    if (rows.length === 0) return toast.show(t('rep.nothingToExport'), 'error')
    downloadCSV(name, toCSV(rows, cols))
    toast.show(t('rep.exported', { n: rows.length }))
  }

  const empty = state.sales.length === 0 && state.expenses.length === 0
  const gl = { day: t('rep.day'), week: t('rep.week'), month: t('rep.month') }
  const labels = { sales: t('dash.sales'), expenses: t('dash.opex') }

  return (
    <>
      <PageHeader title={t('rep.title')} subtitle={t('rep.subtitle')} />
      {empty ? (
        <div className="card">
          <EmptyState icon={BarChart3} title={t('rep.emptyTitle')} text={t('rep.emptyText')}>
            <a className="btn btn-primary" href="#/sales">{t('sales.add')}</a>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="card controls">
            <div className="filters">
              <label className="inline">{t('common.from')} <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="inline">{t('common.to')} <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
              <div className="preset-row">
                <button className="btn btn-sm" onClick={() => preset(7)}>{t('dash.7d')}</button>
                <button className="btn btn-sm" onClick={() => preset(30)}>{t('dash.30d')}</button>
                <button className="btn btn-sm" onClick={() => preset('month')}>{t('rep.thisMonth')}</button>
                <button className="btn btn-sm" onClick={() => preset('all')}>{t('dash.all')}</button>
              </div>
            </div>
            <div className="filters">
              <span className="muted small">{t('rep.groupBy')}</span>
              <Segmented value={g} onChange={setG} label={t('rep.groupBy')} options={[{ value: 'day', label: gl.day }, { value: 'week', label: gl.week }, { value: 'month', label: gl.month }]} />
            </div>
          </div>

          {invalid && <Notice tone="warn">{t('rep.badRange')}</Notice>}

          {data && (
            <>
              <div className="stats stats-4">
                <StatCard label={t('dash.totalSales')} value={formatMoney(data.sum.revenue)} sub={t('rep.transactions', { n: data.sum.count })} />
                <StatCard label={t('rep.totalExpenses')} value={formatMoney(data.sum.opex)} />
                <StatCard label={t('dash.grossProfit')} value={formatMoney(data.sum.grossProfit)} sub={t('dash.margin', { p: formatPercent(data.sum.grossMargin) })} tone={data.sum.grossProfit < 0 ? 'neg' : 'default'} />
                <StatCard label={t('dash.estNet')} value={formatMoney(data.sum.netProfit)} sub={t('dash.margin', { p: formatPercent(data.sum.netMargin) })} tone={data.sum.netProfit < 0 ? 'neg' : 'accent'} />
              </div>
              <p className="muted small formula-note">{t('dash.estNote')}</p>

              <div className="card">
                <div className="card-head">
                  <div>
                    <h3>{t('rep.summaryTitle', { g: gl[g] })}</h3>
                    <p className="muted small">{t('rep.summarySub')}</p>
                  </div>
                  <button className="btn btn-sm" onClick={() => exportCsv('summary')}><Download size={16} /> {t('rep.exportSummary')}</button>
                </div>
                {data.periods.length === 0 ? <p className="muted pad">{t('dash.noRange')}</p> : (
                  <>
                    <div className="chart-body"><SalesExpensesChart rows={data.periods} granularity={g} labels={labels} /></div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{g === 'week' ? t('rep.weekStarting') : t('rep.period')}</th>
                            <th className="num">{t('dash.sales')}</th>
                            <th className="num">{t('f.cogs')}</th>
                            <th className="num">{t('dash.grossProfit')}</th>
                            <th className="num">{t('dash.opex')}</th>
                            <th className="num">{t('dash.netProfit')}</th>
                            <th className="num">{t('rep.grossMargin')}</th>
                            <th className="num">{t('rep.netMargin')}</th>
                            <th className="num">{t('rep.salesChange')}</th>
                            <th className="num">{t('rep.profitChange')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...data.periods].reverse().map((r) => (
                            <tr key={r.key}>
                              <td data-label={t('rep.period')}><strong>{periodLabel(r.key, g)}</strong></td>
                              <td className="num" data-label={t('dash.sales')}>{formatMoney(r.revenue)}</td>
                              <td className="num" data-label={t('f.cogs')}>{formatMoney(r.cogs)}</td>
                              <td className="num" data-label={t('dash.grossProfit')}>{formatMoney(r.grossProfit)}</td>
                              <td className="num" data-label={t('dash.opex')}>{formatMoney(r.opex)}</td>
                              <td className={`num ${r.netProfit < 0 ? 'neg' : 'pos'}`} data-label={t('dash.netProfit')}>{formatMoney(r.netProfit)}</td>
                              <td className="num" data-label={t('rep.grossMargin')}>{formatPercent(r.grossMargin)}</td>
                              <td className="num" data-label={t('rep.netMargin')}>{formatPercent(r.netMargin)}</td>
                              <td className="num" data-label={t('rep.salesChange')}>{formatChange(r.salesChange)}</td>
                              <td className="num" data-label={t('rep.profitChange')}>{formatChange(r.profitChange)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div className="two-col">
                <div className="card">
                  <h3>{t('rep.categoryTitle')}</h3>
                  <p className="muted small">{t('rep.categorySub')}</p>
                  {data.cats.length === 0 ? <p className="muted pad">{t('dash.noRange')}</p> : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>{t('f.category')}</th><th className="num">{t('dash.sales')}</th><th className="num">{t('rep.revShare')}</th><th className="num">{t('dash.grossProfit')}</th><th className="num">{t('rep.profitShare')}</th></tr></thead>
                        <tbody>
                          {data.cats.map((c) => (
                            <tr key={c.category}>
                              <td data-label={t('f.category')}><strong>{c.category}</strong></td>
                              <td className="num" data-label={t('dash.sales')}>{formatMoney(c.revenue)}</td>
                              <td className="num" data-label={t('rep.revShare')}>{formatPercent(c.revenueShare)}</td>
                              <td className="num" data-label={t('dash.grossProfit')}>{formatMoney(c.profit)}</td>
                              <td className="num" data-label={t('rep.profitShare')}>{formatPercent(c.profitShare)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="card">
                  <h3>{t('rep.productTitle')}</h3>
                  <p className="muted small">{t('rep.productSub')}</p>
                  {data.products.length === 0 ? <p className="muted pad">{t('dash.noRange')}</p> : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>{t('f.product')}</th><th className="num">{t('f.quantity')}</th><th className="num">{t('dash.sales')}</th><th className="num">{t('dash.grossProfit')}</th><th className="num">{t('rep.grossMargin')}</th></tr></thead>
                        <tbody>
                          {data.products.map((p) => (
                            <tr key={p.name.toLowerCase()}>
                              <td data-label={t('f.product')}><strong>{p.name}</strong></td>
                              <td className="num" data-label={t('f.quantity')}>{formatNumber(p.quantity)}</td>
                              <td className="num" data-label={t('dash.sales')}>{formatMoney(p.revenue)}</td>
                              <td className="num" data-label={t('dash.grossProfit')}>{formatMoney(p.profit)}</td>
                              <td className="num" data-label={t('rep.grossMargin')}>{formatPercent(p.margin)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="card">
            <h3>{t('rep.exportTitle')}</h3>
            <p className="muted small">{t('rep.exportSub')}</p>
            <div className="btn-row">
              <button className="btn" disabled={invalid} onClick={() => exportCsv('sales')}><Download size={16} /> {t('rep.exportSales')}</button>
              <button className="btn" disabled={invalid} onClick={() => exportCsv('expenses')}><Download size={16} /> {t('rep.exportExpenses')}</button>
              <button className="btn" onClick={() => exportCsv('products')}><Download size={16} /> {t('rep.exportProducts')}</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
