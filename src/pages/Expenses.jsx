import { useMemo, useState } from 'react'
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { useT } from '../i18n/index.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader, useToast } from '../components/ui.jsx'
import { formatMoney, round2 } from '../lib/money.js'
import { shortDate, todayStr } from '../lib/dates.js'
import { EXPENSE_CATEGORIES } from '../lib/constants.js'

export const catLabel = (t, c) => {
  const k = `expcat.${c}`
  const v = t(k)
  return v === k ? c : v
}

function ExpenseForm({ expense, onClose }) {
  const t = useT()
  const toast = useToast()
  const { actions } = useStore()
  const editing = !!expense
  const cats = expense && !EXPENSE_CATEGORIES.includes(expense.category) ? [...EXPENSE_CATEGORIES, expense.category] : EXPENSE_CATEGORIES
  const [f, setF] = useState({
    date: expense?.date ?? todayStr(),
    category: expense?.category ?? 'Rent',
    description: expense?.description ?? '',
    amount: expense ? String(expense.amount) : '',
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const submit = (e) => {
    e.preventDefault()
    const res = editing ? actions.updateExpense(expense.id, f) : actions.addExpense(f)
    if (res.errors || res.error) return setErrors(res.errors || {})
    toast.show(t(editing ? 'exp.updated' : 'exp.added'))
    onClose()
  }
  const err = (k) => (errors[k] ? t(errors[k]) : null)
  return (
    <Modal title={t(editing ? 'exp.edit' : 'exp.add')} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label={t('f.date')} error={err('date')}>
            {(p) => <input {...p} type="date" max={todayStr()} value={f.date} onChange={(e) => set('date', e.target.value)} />}
          </Field>
          <Field label={t('f.expenseCategory')} error={err('category')}>
            {(p) => (
              <select {...p} value={f.category} onChange={(e) => set('category', e.target.value)}>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {catLabel(t, c)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('f.amount')} error={err('amount')}>
            {(p) => <input {...p} type="number" inputMode="decimal" min="0" step="any" value={f.amount} onChange={(e) => set('amount', e.target.value)} />}
          </Field>
          <Field label={t('f.description')} error={err('description')}>
            {(p) => <input {...p} maxLength={200} value={f.description} onChange={(e) => set('description', e.target.value)} />}
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t(editing ? 'common.saveChanges' : 'exp.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Expenses() {
  const t = useT()
  const toast = useToast()
  const { state, actions } = useStore()
  const [form, setForm] = useState(null)
  const [del, setDel] = useState(null)
  const [cat, setCat] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const cats = useMemo(() => [...new Set([...EXPENSE_CATEGORIES, ...state.expenses.map((e) => e.category)])], [state.expenses])
  const rows = useMemo(
    () =>
      [...state.expenses]
        .filter((e) => (!cat || e.category === cat) && (!from || e.date >= from) && (!to || e.date <= to))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [state.expenses, cat, from, to],
  )
  const total = round2(rows.reduce((a, e) => a + e.amount, 0))

  return (
    <>
      <PageHeader
        title={t('exp.title')}
        subtitle={t('exp.subtitle')}
        actions={
          <button className="btn btn-primary" onClick={() => setForm('new')}>
            <Plus size={18} /> {t('exp.add')}
          </button>
        }
      />
      {state.expenses.length === 0 ? (
        <div className="card">
          <EmptyState icon={Receipt} title={t('exp.emptyTitle')} text={t('exp.emptyText')}>
            <button className="btn btn-primary" onClick={() => setForm('new')}>
              <Plus size={18} /> {t('exp.add')}
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div className="filters">
            <select aria-label={t('f.expenseCategory')} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">{t('exp.allCategories')}</option>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {catLabel(t, c)}
                </option>
              ))}
            </select>
            <label className="inline">
              {t('common.from')} <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="inline">
              {t('common.to')} <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            {(cat || from || to) && (
              <button className="btn btn-sm" onClick={() => { setCat(''); setFrom(''); setTo('') }}>
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
                    <th>{t('f.expenseCategory')}</th>
                    <th>{t('f.description')}</th>
                    <th className="num">{t('f.amount')}</th>
                    <th className="actions-col">
                      <span className="sr-only">{t('common.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td data-label={t('f.date')}>{e.date}</td>
                      <td data-label={t('f.expenseCategory')}>
                        <span className="chip">{catLabel(t, e.category)}</span>
                      </td>
                      <td data-label={t('f.description')}>{e.description || '—'}</td>
                      <td className="num" data-label={t('f.amount')}>{formatMoney(e.amount)}</td>
                      <td className="actions-col">
                        <button className="icon-btn" aria-label={`${t('common.edit')} ${catLabel(t, e.category)} ${e.date}`} onClick={() => setForm(e)}>
                          <Pencil size={17} />
                        </button>
                        <button className="icon-btn danger" aria-label={`${t('common.delete')} ${catLabel(t, e.category)} ${e.date}`} onClick={() => setDel(e)}>
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>{t('common.totalFor', { n: rows.length })}</td>
                    <td className="num">{formatMoney(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
      {form && <ExpenseForm expense={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {del && (
        <ConfirmDialog
          title={t('exp.deleteTitle')}
          message={t('exp.deleteMsg', { name: catLabel(t, del.category), date: shortDate(del.date), amount: formatMoney(del.amount) })}
          confirmLabel={t('common.delete')}
          onCancel={() => setDel(null)}
          onConfirm={() => {
            actions.deleteExpense(del.id)
            setDel(null)
            toast.show(t('exp.deleted'))
          }}
        />
      )}
    </>
  )
}
