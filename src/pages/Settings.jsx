import { useState } from 'react'
import { Database, Info, RotateCcw, Trash2 } from 'lucide-react'
import { LANGUAGES, useLang } from '../i18n/index.jsx'
import { useT } from '../i18n/index.jsx'
import { useStore } from '../store/StoreContext.jsx'
import { ConfirmDialog, Notice, PageHeader, useToast } from '../components/ui.jsx'
import { hasSample } from '../lib/store.js'

export default function Settings() {
  const t = useT()
  const { lang, setLang } = useLang()
  const toast = useToast()
  const { state, actions } = useStore()
  const [confirm, setConfirm] = useState(null)
  const sampleOn = hasSample(state)
  const counts = { p: state.products.length, s: state.sales.length, e: state.expenses.length }
  const langs = Object.entries(LANGUAGES)

  const doConfirm = () => {
    if (confirm === 'sample') {
      actions.removeSample()
      toast.show(t('settings.sampleRemovedMsg'))
    } else {
      actions.resetAll()
      toast.show(t('settings.resetMsg'))
    }
    setConfirm(null)
  }

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div className="card">
        <h3><Database size={18} /> {t('settings.dataTitle')}</h3>
        <p className="muted">{t('settings.dataText', { p: counts.p, s: counts.s, e: counts.e })}</p>
        <div className="setting-row">
          <div>
            <strong>{t('settings.loadSample')}</strong>
            <p className="muted small">{t('settings.loadSampleText')}</p>
          </div>
          <button
            className="btn btn-primary"
            disabled={sampleOn}
            onClick={() => {
              const r = actions.loadSample()
              toast.show(r.error ? t(r.error) : t('settings.sampleLoadedMsg'), r.error ? 'error' : 'success')
            }}
          >
            {sampleOn ? t('settings.sampleLoaded') : t('settings.loadSample')}
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>{t('settings.removeSample')}</strong>
            <p className="muted small">{t('settings.removeSampleText')}</p>
          </div>
          <button className="btn" disabled={!sampleOn} onClick={() => setConfirm('sample')}>
            <RotateCcw size={16} /> {t('settings.removeSample')}
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>{t('settings.reset')}</strong>
            <p className="muted small">{t('settings.resetText')}</p>
          </div>
          <button className="btn btn-danger" onClick={() => setConfirm('reset')}>
            <Trash2 size={16} /> {t('settings.reset')}
          </button>
        </div>
        <Notice tone="warn">{t('settings.backupNote')}</Notice>
      </div>

      {langs.length > 1 && (
        <div className="card">
          <h3>{t('settings.language')}</h3>
          <select aria-label={t('settings.language')} value={lang} onChange={(e) => setLang(e.target.value)}>
            {langs.map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="card">
        <h3><Info size={18} /> {t('settings.howTitle')}</h3>
        <ul className="plain-list">
          {['settings.how1', 'settings.how2', 'settings.how3', 'settings.how4', 'settings.how5'].map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
        <h4>{t('settings.limitsTitle')}</h4>
        <ul className="plain-list">
          {['settings.limit1', 'settings.limit2', 'settings.limit3'].map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </div>

      {confirm && (
        <ConfirmDialog
          title={t(confirm === 'sample' ? 'settings.removeSampleTitle' : 'settings.resetTitle')}
          message={t(confirm === 'sample' ? 'settings.removeSampleConfirm' : 'settings.resetConfirm')}
          confirmLabel={t(confirm === 'sample' ? 'settings.removeSample' : 'settings.resetYes')}
          onCancel={() => setConfirm(null)}
          onConfirm={doConfirm}
        />
      )}
    </>
  )
}
