import { useMemo, useState } from 'react'
import { Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useT } from '../i18n/index.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader, useToast } from '../components/ui.jsx'
import { formatMoney, formatNumber, round2 } from '../lib/money.js'
import { todayStr } from '../lib/dates.js'
import { availableStock } from '../lib/store.js'
import { PRODUCT_CATEGORIES } from '../lib/constants.js'
import { shortDate } from '../lib/dates.js'

const OTHER = '__other'

function SaleForm({ sale, onClose }) {
  const t = useT()
  const toast = useToast()
  const { state, actions } = useStore()
  const editing = !!sale
  const startProduct = sale?.productId && state.products.some((p) => p.id === sale.productId) ? sale.productId : sale ? OTHER : state.products.length ? '' : OTHER
  const [f, setF] = useState({
    date: sale?.date ?? todayStr(),
    product: startProduct,
    productName: sale && startProduct === OTHER ? sale.productName : '',
    category: sale && startProduct === OTHER ? sale.category : 'Other',
    quantity: sale ? String(sale.quantity) : '',
    sellPrice: sale ? String(sale.sellPrice) : '',
    costPrice: sale ? String(sale.costPrice) : '',
  })
  const [errors, setErrors] = useState({})
  const [stockLeft, setStockLeft] = useState(null)
  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const onProduct = (id) => {
    const p = state.products.find((x) => x.id === id)
    setF((prev) => ({ ...prev, product: id, ...(p ? { sellPrice: String(p.sellPrice), costPrice: String(p.costPrice) } : {}) }))
    setErrors({})
  }

  const tracked = f.product && f.product !== OTHER
  const avail = tracked ? availableStock(state, f.product, sale?.id) : null
  const q = Number(f.quantity)
  const sp = Number(f.sellPrice)
  const cp = Number(f.costPrice)
  const ok = Number.isFinite(q) && Number.isFinite(sp) && Number.isFinite(cp) && f.quantity !== '' && f.sellPrice !== '' && f.costPrice !== ''
  const revenue = ok ? round2(q * sp) : null
  const cogs = ok ? round2(q * cp) : null

  const submit = (e) => {
    e.preventDefault()
    const input = {
      date: f.date,
      productId: tracked ? f.product : null,
      productName: f.productName,
      category: f.category,
      quantity: f.quantity,
      sellPrice: f.sellPrice,
      costPrice: f.costPrice,
    }
    const res = editing ? actions.updateSale(sale.id, input) : actions.addSale(input)
    if (res.errors || res.error) {
      setErrors(res.errors || {})
      setStockLeft(res.stockLeft ?? null)
      return
    }
    toast.show(t(editing ? 'sales.updated' : 'sales.added'))
    onClose()
  }

  const err = (k) => (errors[k] ? t(errors[k], { stock: formatNumber(stockLeft ?? avail ?? 0) }) : null)

  return (
    <Modal title={t(editing ? 'sales.edit' : 'sales.add')} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label={t('f.date')} error={err('date')}>
            {(p) => <input {...p} type="date" max={todayStr()} value={f.date} onChange={(e) => set('date', e.target.value)} />}
          </Field>
          <Field label={t('f.product')} error={err('productName')}>
            {(p) => (
              <select {...p} value={f.product} onChange={(e) => onProduct(e.target.value)}>
                {!state.products.length || f.product === '' ? <option value="" disabled>{t('sales.chooseProduct')}</option> : null}
                {state.products.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} ({t('f.inStock', { n: formatNumber(pr.stock) })})
                  </option>
                ))}
                <option value={OTHER}>{t('sales.otherProduct')}</option>
              </select>
            )}
          </Field>
          {f.product === OTHER && (
            <>
              <Field label={t('f.productName')} error={err('productName')}>
                {(p) => <input {...p} value={f.productName} maxLength={80} onChange={(e) => set('productName', e.target.value)} />}
              </Field>
              <Field label={t('f.category')} hint={t('sales.untracked')}>
                {(p) => (
                  <>
                    <input {...p} list="cat-list" value={f.category} onChange={(e) => set('category', e.target.value)} />
                    <datalist id="cat-list">
                      {PRODUCT_CATEGORIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
            </>
          )}
          <Field label={t('f.quantity')} error={err('quantity')} hint={tracked ? t('f.available', { n: formatNumber(avail) }) : null}>
            {(p) => <input {...p} type="number" inputMode="decimal" min="0" step="any" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} />}
          </Field>
          <Field label={t('f.sellPrice')} error={err('sellPrice')}>
            {(p) => <input {...p} type="number" inputMode="decimal" min="0" step="any" value={f.sellPrice} onChange={(e) => set('sellPrice', e.target.value)} />}
          </Field>
          <Field label={t('f.costPrice')} error={err('costPrice')}>
            {(p) => <input {...p} type="number" inputMode="decimal" min="0" step="any" value={f.costPrice} onChange={(e) => set('costPrice', e.target.value)} />}
          </Field>
        </div>

        <div className="calc-preview" aria-live="polite">
          <div>
            <span>{t('f.revenue')}</span>
            <strong>{ok ? formatMoney(revenue) : '—'}</strong>
          </div>
          <div>
            <span>{t('f.cogs')}</span>
            <strong>{ok ? formatMoney(cogs) : '—'}</strong>
          </div>
          <div>
            <span>{t('f.grossProfit')}</span>
            <strong className={ok && revenue - cogs < 0 ? 'neg' : ''}>{ok ? formatMoney(round2(revenue - cogs)) : '—'}</strong>
          </div>
        </div>
        {editing && tracked && <p className="muted small">{t('sales.editStockNote')}</p>}

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t(editing ? 'common.saveChanges' : 'sales.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Sales() {
  const t = useT()
  const toast = useToast()
  const { state, actions } = useStore()
  const [form, setForm] = useState(null) // null | 'new' | sale
  const [del, setDel] = useState(null)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...state.sales]
      .filter((s) => (!needle || s.productName.toLowerCase().includes(needle)) && (!from || s.date >= from) && (!to || s.date <= to))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [state.sales, q, from, to])

  const totals = rows.reduce((a, s) => ({ revenue: a.revenue + s.revenue, cogs: a.cogs + s.cogs, profit: a.profit + s.grossProfit }), { revenue: 0, cogs: 0, profit: 0 })

  return (
    <>
      <PageHeader
        title={t('sales.title')}
        subtitle={t('sales.subtitle')}
        actions={
          <button className="btn btn-primary" onClick={() => setForm('new')}>
            <Plus size={18} /> {t('sales.add')}
          </button>
        }
      />
      {state.sales.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShoppingCart} title={t('sales.emptyTitle')} text={t('sales.emptyText')}>
            <button className="btn btn-primary" onClick={() => setForm('new')}>
              <Plus size={18} /> {t('sales.add')}
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div className="filters">
            <input type="search" placeholder={t('common.search')} aria-label={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="inline">
              {t('common.from')} <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="inline">
              {t('common.to')} <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            {(q || from || to) && (
              <button className="btn btn-sm" onClick={() => { setQ(''); setFrom(''); setTo('') }}>
                {t('common.clearFilters')}
              </button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="muted pad">{t('common.noMatches')}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('f.date')}</th>
                    <th>{t('f.product')}</th>
                    <th className="num">{t('f.quantity')}</th>
                    <th className="num">{t('f.sellPrice')}</th>
                    <th className="num">{t('f.costPrice')}</th>
                    <th className="num">{t('f.revenue')}</th>
                    <th className="num">{t('f.cogs')}</th>
                    <th className="num">{t('f.grossProfit')}</th>
                    <th className="actions-col">
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td data-label={t('f.date')}>{s.date}</td>
                      <td data-label={t('f.product')}>
                        <strong>{s.productName}</strong>
                      </td>
                      <td className="num" data-label={t('f.quantity')}>{formatNumber(s.quantity)}</td>
                      <td className="num" data-label={t('f.sellPrice')}>{formatMoney(s.sellPrice)}</td>
                      <td className="num" data-label={t('f.costPrice')}>{formatMoney(s.costPrice)}</td>
                      <td className="num" data-label={t('f.revenue')}>{formatMoney(s.revenue)}</td>
                      <td className="num" data-label={t('f.cogs')}>{formatMoney(s.cogs)}</td>
                      <td className={`num ${s.grossProfit < 0 ? 'neg' : 'pos'}`} data-label={t('f.grossProfit')}>{formatMoney(s.grossProfit)}</td>
                      <td className="actions-col">
                        <button className="icon-btn" aria-label={`${t('common.edit')} ${s.productName}`} onClick={() => setForm(s)}>
                          <Pencil size={17} />
                        </button>
                        <button className="icon-btn danger" aria-label={`${t('common.delete')} ${s.productName}`} onClick={() => setDel(s)}>
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>{t('common.totalFor', { n: rows.length })}</td>
                    <td className="num">{formatMoney(round2(totals.revenue))}</td>
                    <td className="num">{formatMoney(round2(totals.cogs))}</td>
                    <td className="num">{formatMoney(round2(totals.profit))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
      {form && <SaleForm sale={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {del && (
        <ConfirmDialog
          title={t('sales.deleteTitle')}
          message={t('sales.deleteMsg', { name: del.productName, date: shortDate(del.date) })}
          confirmLabel={t('common.delete')}
          onCancel={() => setDel(null)}
          onConfirm={() => {
            actions.deleteSale(del.id)
            setDel(null)
            toast.show(t('sales.deleted'))
          }}
        />
      )}
    </>
  )
}
