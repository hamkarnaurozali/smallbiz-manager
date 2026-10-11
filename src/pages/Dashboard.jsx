import { useMemo, useState } from 'react'
import { BarChart3, Coins, Receipt, ShoppingCart, TrendingUp, Wallet, Package } from 'lucide-react'
import { useT } from '../i18n/index.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { ChartCard, EmptyState, Notice, PageHeader, Segmented, StatCard, useToast } from '../components/ui.jsx'
import { ProfitChart, SalesExpensesChart, TopProductsChart } from '../components/charts.jsx'
import { autoGranularity, filterByDate, groupByPeriod, productPerformance, rangeBounds, spanDays, summarize } from '../lib/calc.js'
import { formatMoney, formatNumber, formatPercent } from '../lib/money.js'
import { todayStr } from '../lib/dates.js'
import { stockStatus } from './Products.jsx'

export default function Dashboard() {
  const t = useT()
  const toast = useToast()
  const { state, actions } = useStore()
  const [range, setRange] = useState('30d')

  const view = useMemo(() => {
    const today = todayStr()
    let { from, to } = rangeBounds(range, today)
    const sales = filterByDate(state.sales, from, to)
    const expenses = filterByDate(state.expenses, from, to)
    const all = [...state.sales, ...state.expenses].map((r) => r.date).sort()
    const f = from ?? all[0] ?? today
    const g = range === 'all' ? autoGranularity(spanDays(f, today)) : 'day'
    const rows = range === 'all' && !all.length ? [] : groupByPeriod(sales, expenses, g, from ?? f, to ?? today)
    return { sum: summarize(sales, expenses), rows, g, top: productPerformance(sales).slice(0, 6), hasSales: sales.length > 0 || expenses.length > 0 }
  }, [state.sales, state.expenses, range])

  const lowStock = state.products.filter((p) => stockStatus(p) !== 'ok')
  const noData = state.sales.length === 0 && state.expenses.length === 0 && state.products.length === 0
  const { sum } = view
  const opts = [
    { value: 'today', label: t('dash.today') },
    { value: '7d', label: t('dash.7d') },
    { value: '30d', label: t('dash.30d') },
    { value: 'all', label: t('dash.all') },
  ]

  if (noData) {
    return (
      <>
        <PageHeader title={t('dash.title')} subtitle={t('dash.subtitle')} />
        <div className="card">
          <EmptyState icon={BarChart3} title={t('dash.emptyTitle')} text={t('dash.emptyText')}>
            <a className="btn btn-primary" href="#/products">
              <Package size={18} /> {t('prod.add')}
            </a>
            <a className="btn" href="#/sales">
              <ShoppingCart size={18} /> {t('sales.add')}
            </a>
            <button
              className="btn"
              onClick={() => {
                const r = actions.loadSample()
                toast.show(r.error ? t(r.error) : t('settings.sampleLoadedMsg'), r.error ? 'error' : 'success')
              }}
            >
              {t('settings.loadSample')}
            </button>
          </EmptyState>
        </div>
      </>
    )
  }

  const labels = { sales: t('dash.sales'), expenses: t('dash.opex'), gross: t('dash.grossProfit'), net: t('dash.netProfit') }
  const noTx = !view.hasSales
  const emptyMsg = <span>{t('dash.noRange')}</span>

  return (
    <>
      <PageHeader title={t('dash.title')} subtitle={t('dash.subtitle')} actions={<Segmented value={range} onChange={setRange} options={opts} label={t('dash.period')} />} />

      <div className="stats">
        <StatCard icon={Coins} label={t('dash.totalSales')} value={formatMoney(sum.revenue)} />
        <StatCard icon={Package} label={t('dash.cogs')} value={formatMoney(sum.cogs)} sub={t('dash.cogsSub')} />
        <StatCard icon={Receipt} label={t('dash.opex')} value={formatMoney(sum.opex)} sub={t('dash.opexSub')} />
        <StatCard icon={TrendingUp} label={t('dash.grossProfit')} value={formatMoney(sum.grossProfit)} tone={sum.grossProfit < 0 ? 'neg' : 'default'} sub={t('dash.margin', { p: formatPercent(sum.grossMargin) })} />
        <StatCard icon={Wallet} label={t('dash.estNet')} value={formatMoney(sum.netProfit)} tone={sum.netProfit < 0 ? 'neg' : 'accent'} sub={t('dash.margin', { p: formatPercent(sum.netMargin) })} />
        <StatCard icon={ShoppingCart} label={t('dash.transactions')} value={formatNumber(sum.count)} />
      </div>
      <p className="muted small formula-note">{t('dash.estNote')}</p>

      {lowStock.length > 0 && (
        <Notice tone="warn">
          <strong>{t('prod.attention', { n: lowStock.length })}</strong> {lowStock.slice(0, 6).map((p) => p.name).join(', ')}
          {lowStock.length > 6 ? '…' : ''} <a href="#/products">{t('dash.viewProducts')}</a>
        </Notice>
      )}

      <div className="chart-grid">
        <ChartCard title={t('dash.chartSalesExp')} subtitle={view.g === 'day' ? t('common.perDay') : view.g === 'week' ? t('common.perWeek') : t('common.perMonth')} empty={noTx ? emptyMsg : null}>
          <SalesExpensesChart rows={view.rows} granularity={view.g} labels={labels} />
        </ChartCard>
        <ChartCard title={t('dash.chartProfit')} subtitle={t('dash.chartProfitSub')} empty={noTx ? emptyMsg : null}>
          <ProfitChart rows={view.rows} granularity={view.g} labels={labels} />
        </ChartCard>
        <ChartCard title={t('dash.chartTop')} subtitle={t('dash.chartTopSub')} empty={view.top.length === 0 ? emptyMsg : null}>
          <TopProductsChart products={view.top} label={t('dash.sales')} />
        </ChartCard>
      </div>
    </>
  )
}
