import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useT } from '../i18n/index.jsx'

/* ------------------------------- Toasts ------------------------------- */
const ToastContext = createContext({ show: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const show = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ------------------------------- Modal -------------------------------- */
export function Modal({ title, onClose, children, wide = false }) {
  const t = useT()
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const first = ref.current?.querySelector('input, select, button.btn-primary, button')
    first?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel, danger = true, onConfirm, onCancel }) {
  const t = useT()
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-msg">{message}</p>
      <div className="form-actions">
        <button className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
          {confirmLabel || t('common.confirm')}
        </button>
      </div>
    </Modal>
  )
}

/* ------------------------------- Forms -------------------------------- */
export function Field({ label, error, hint, children }) {
  const t = useT()
  const id = useId()
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {typeof children === 'function' ? children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined }) : children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && (
        <small className="error" id={`${id}-err`}>
          {typeof error === 'string' ? error : t('err.number')}
        </small>
      )}
    </div>
  )
}

/* ------------------------------ Display ------------------------------- */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, sub, tone = 'default', note }) {
  return (
    <div className={`card stat stat-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && (
          <span className="stat-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="empty">
      {Icon && (
        <span className="empty-icon">
          <Icon size={28} />
        </span>
      )}
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}

export function Notice({ tone = 'info', children }) {
  const Icon = tone === 'warn' ? AlertTriangle : Info
  return (
    <div className={`notice notice-${tone}`}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  )
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'active' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      {subtitle && <p className="muted small">{subtitle}</p>}
      {empty ? <div className="chart-empty">{empty}</div> : <div className="chart-body">{children}</div>}
    </div>
  )
}
