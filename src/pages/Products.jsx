import { useMemo, useState } from 'react'
import { AlertTriangle, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { useT } from '../i18n/index.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { ConfirmDialog, EmptyState, Field, Modal, Notice, PageHeader, useToast } from '../components/ui.jsx'
import { formatMoney, formatNumber, formatPercent } from '../lib/money.js'
import { PRODUCT_CATEGORIES } from '../lib/constants.js'

export function stockStatus(p) {
  if (p.stock <= 0) return 'out'
  if (p.stock <= p.lowStockThreshold) return 'low'
  return 'ok'
}

function ProductForm({ product, onClose }) {
  const t = useT()
  const toast = useToast()
  const { actions } = useStore()
  const editing = !!product
  const [f, setF] = useState({
    name: product?.name ?? '',
    category: product?.category ?? 'Other',
    costPrice: product ? String(product.costPrice) : '',
    sellPrice: product ? String(product.sellPrice) : '',
    stock: product ? String(product.stock) : '0',
    lowStockThreshold: product ? String(product.lowStockThreshold) : '5',
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const submit = (e) => {
    e.preventDefault()
    const res = editing ? actions.updateProduct(product.id, f) : actions.addProduct(f)
    if (res.errors || res.error) return setErrors(res.errors || {})
    toast.show(t(editing ? 'prod.updated' : 'prod.added'))
    onClose()
  }
  const err = (k) => (errors[k] ? t(errors[k]) : null)
  const num = (k, extra = {}) => (p) => (
    <input {...p} type="number" inputMode="decimal" min="0" step="any" value={f[k]} onChange={(e) => set(k, e.target.value)} {...extra} />
  )
  return (
    <Modal title={t(editing ? 'prod.edit' : 'prod.add')} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label={t('f.productName')} error={err('name')}>
            {(p) => <input {...p} maxLength={80} value={f.name} onChange={(e) => set('name', e.target.value)} />}
          </Field>
          <Field label={t('f.category')} error={err('category')}>
            {(p) => (
              <>
                <input {...p} list="prod-cats" value={f.category} onChange={(e) => set('category', e.target.value)} />
                <datalist id="prod-cats">
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label={t('f.purchaseCost')} error={err('costPrice')}>
            {num('costPrice')}
          </Field>
          <Field label={t('f.sellPrice')} error={err('sellPrice')}>
            {num('sellPrice')}
          </Field>
          <Field label={t('f.stock')} error={err('stock')} hint={editing ? t('prod.stockHint') : null}>
            {num('stock')}
          </Field>
          <Field label={t('f.lowStock')} error={err('lowStockThreshold')} hint={t('prod.lowHint')}>
            {num('lowStockThreshold')}
          </Field>
        </div>
        {editing && <p className="muted small">{t('prod.priceNote')}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t(editing ? 'common.saveChanges' : 'prod.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Products() {
  const t = useT()
  const toast = useToast()
  const { state, actions } = useStore()
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase()
    return [...state.products]
      .filter((p) => !n || p.name.toLowerCase().includes(n) || p.category.toLowerCase().includes(n))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [state.products, q])
  const attention = state.products.filter((p) => stockStatus(p) !== 'ok')
  const stockValue = state.products.reduce((a, p) => a + p.stock * p.costPrice, 0)

  return (
    <>
      <PageHeader
        title={t('prod.title')}
        subtitle={t('prod.subtitle')}
        actions={
          <button className="btn btn-primary" onClick={() => setForm('new')}>
            <Plus size={18} /> {t('prod.add')}
          </button>
        }
      />
      {attention.length > 0 && (
        <Notice tone="warn">
          <strong>{t('prod.attention', { n: attention.length })}</strong> {attention.map((p) => p.name).join(', ')}
        </Notice>
      )}
      {state.products.length === 0 ? (
        <div className="card">
          <EmptyState icon={Package} title={t('prod.emptyTitle')} text={t('prod.emptyText')}>
            <button className="btn btn-primary" onClick={() => setForm('new')}>
              <Plus size={18} /> {t('prod.add')}
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div className="filters">
            <input type="search" placeholder={t('common.search')} aria-label={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="muted small push-end">{t('prod.stockValue', { v: formatMoney(stockValue) })}</span>
          </div>
          {rows.length === 0 ? (
            <p className="muted pad">{t('common.noMatches')}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('f.productName')}</th>
                    <th>{t('f.category')}</th>
                    <th className="num">{t('f.purchaseCost')}</th>
                    <th className="num">{t('f.sellPrice')}</th>
                    <th className="num">{t('prod.margin')}</th>
                    <th className="num">{t('f.stock')}</th>
                    <th>{t('prod.status')}</th>
                    <th className="actions-col">
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const st = stockStatus(p)
                    return (
                      <tr key={p.id}>
                        <td data-label={t('f.productName')}><strong>{p.name}</strong></td>
                        <td data-label={t('f.category')}><span className="chip">{p.category}</span></td>
                        <td className="num" data-label={t('f.purchaseCost')}>{formatMoney(p.costPrice)}</td>
                        <td className="num" data-label={t('f.sellPrice')}>{formatMoney(p.sellPrice)}</td>
                        <td className="num" data-label={t('prod.margin')}>{formatPercent(p.sellPrice > 0 ? ((p.sellPrice - p.costPrice) / p.sellPrice) * 100 : null)}</td>
                        <td className="num" data-label={t('f.stock')}>{formatNumber(p.stock)}</td>
                        <td data-label={t('prod.status')}>
                          <span className={`badge badge-${st}`}>
                            {st !== 'ok' && <AlertTriangle size={13} />} {t(`prod.status.${st}`)}
                          </span>
                        </td>
                        <td className="actions-col">
                          <button className="icon-btn" aria-label={`${t('common.edit')} ${p.name}`} onClick={() => setForm(p)}>
                            <Pencil size={17} />
                          </button>
                          <button className="icon-btn danger" aria-label={`${t('common.delete')} ${p.name}`} onClick={() => setDel(p)}>
                            <Trash2 size={17} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {form && <ProductForm product={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {del && (
        <ConfirmDialog
          title={t('prod.deleteTitle')}
          message={t('prod.deleteMsg', { name: del.name })}
          confirmLabel={t('common.delete')}
          onCancel={() => setDel(null)}
          onConfirm={() => {
            actions.deleteProduct(del.id)
            setDel(null)
            toast.show(t('prod.deleted'))
          }}
        />
      )}
    </>
  )
}
