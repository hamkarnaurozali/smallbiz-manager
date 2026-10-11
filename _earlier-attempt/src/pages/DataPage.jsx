import { useRef, useState } from 'react';
import { Database, DatabaseBackup, Download, FileSpreadsheet, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { useToast } from '../components/Toast.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';
import { Card, PageHeader } from '../components/ui.jsx';
import { downloadFile, expensesToCsv, productsToCsv, salesToCsv } from '../lib/csv.js';
import { hasAnyData, hasSampleData } from '../lib/ledger.js';
import { buildBackup, parseBackup } from '../lib/storage.js';
import { todayISO } from '../lib/dates.js';

export default function DataPage() {
  const { t } = useI18n();
  const notify = useToast();
  const { state, actions } = useStore();
  const [confirm, setConfirm] = useState(null); // 'load' | 'remove' | 'reset' | { type: 'import', text, result }
  const fileRef = useRef(null);
  const sampleLoaded = hasSampleData(state);
  const today = todayISO();

  const loadSample = () => {
    const result = actions.loadSample();
    notify(result.ok ? t('data.sampleLoaded') : t('data.sampleAlready'), result.ok ? 'success' : 'error');
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
    } catch {
      notify(t('data.importFailed'), 'error');
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      notify(t('data.importInvalid'), 'error');
      return;
    }
    setConfirm({ type: 'import', text, result });
  };

  return (
    <>
      <PageHeader title={t('nav.data')} subtitle={t('data.subtitle')} />

      <Card title={t('data.sampleTitle')} subtitle={t('data.sampleText')}>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={sampleLoaded} onClick={() => (hasAnyData(state) ? setConfirm('load') : loadSample())}>
            <Database size={18} aria-hidden="true" /> {t('data.loadSample')}
          </button>
          <button type="button" className="btn btn-secondary" disabled={!sampleLoaded} onClick={() => setConfirm('remove')}>
            <Trash2 size={18} aria-hidden="true" /> {t('data.removeSample')}
          </button>
        </div>
        <p className="muted small">{sampleLoaded ? t('data.sampleStatusLoaded') : t('data.sampleStatusNone')}</p>
        <p className="muted small">{t('data.samplePricesNote')}</p>
      </Card>

      <Card title={t('data.exportTitle')} subtitle={t('data.exportText')}>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={state.products.length === 0}
            onClick={() => {
              downloadFile(`smallbiz-products_${today}.csv`, productsToCsv(state.products));
              notify(t('reports.exported'));
            }}
          >
            <FileSpreadsheet size={18} aria-hidden="true" /> {t('data.exportProducts')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={state.sales.length === 0}
            onClick={() => {
              downloadFile(`smallbiz-sales_all_${today}.csv`, salesToCsv(state.sales));
              notify(t('reports.exported'));
            }}
          >
            <FileSpreadsheet size={18} aria-hidden="true" /> {t('data.exportSales')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={state.expenses.length === 0}
            onClick={() => {
              downloadFile(`smallbiz-expenses_all_${today}.csv`, expensesToCsv(state.expenses));
              notify(t('reports.exported'));
            }}
          >
            <FileSpreadsheet size={18} aria-hidden="true" /> {t('data.exportExpenses')}
          </button>
        </div>
        <p className="muted small">{t('data.csvHelp')}</p>
      </Card>

      <Card title={t('data.backupTitle')} subtitle={t('data.backupText')}>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              downloadFile(`smallbiz-backup_${today}.json`, buildBackup(state), 'application/json;charset=utf-8');
              notify(t('data.backupExported'));
            }}
          >
            <DatabaseBackup size={18} aria-hidden="true" /> {t('data.exportBackup')}
          </button>
          <label className="btn btn-secondary file-btn">
            <Upload size={18} aria-hidden="true" /> {t('data.importBackup')}
            <input ref={fileRef} type="file" accept=".json,application/json" className="file-input" onChange={onFile} aria-label={t('data.importBackup')} />
          </label>
        </div>
      </Card>

      <Card title={t('data.resetTitle')} subtitle={t('data.resetText')} className="card-danger">
        <button type="button" className="btn btn-danger" onClick={() => setConfirm('reset')} disabled={!hasAnyData(state)}>
          <RotateCcw size={18} aria-hidden="true" /> {t('data.reset')}
        </button>
      </Card>

      <Card title={t('data.aboutTitle')}>
        <ul className="plain-list">
          <li>{t('data.about1')}</li>
          <li>{t('data.about2')}</li>
          <li>{t('data.about3')}</li>
          <li>{t('data.about4')}</li>
          <li>{t('data.about5')}</li>
        </ul>
      </Card>

      {confirm === 'load' && (
        <ConfirmDialog
          danger={false}
          title={t('data.loadConfirmTitle')}
          message={t('data.loadConfirmText')}
          confirmLabel={t('data.loadSample')}
          onConfirm={() => {
            setConfirm(null);
            loadSample();
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'remove' && (
        <ConfirmDialog
          title={t('data.removeConfirmTitle')}
          message={t('data.removeConfirmText')}
          confirmLabel={t('data.removeSample')}
          onConfirm={() => {
            actions.removeSample();
            setConfirm(null);
            notify(t('data.sampleRemoved'));
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'reset' && (
        <ConfirmDialog
          title={t('data.resetConfirmTitle')}
          message={t('data.resetConfirmText')}
          confirmLabel={t('data.reset')}
          onConfirm={() => {
            actions.resetAll();
            setConfirm(null);
            notify(t('data.resetDone'));
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm && confirm.type === 'import' && (
        <ConfirmDialog
          title={t('data.importConfirmTitle')}
          message={
            <>
              <p>
                {t('data.importConfirmText', {
                  products: confirm.result.state.products.length,
                  sales: confirm.result.state.sales.length,
                  expenses: confirm.result.state.expenses.length,
                })}
              </p>
              {confirm.result.dropped > 0 && <p>{t('data.importDropped', { n: confirm.result.dropped })}</p>}
            </>
          }
          confirmLabel={t('data.importConfirm')}
          onConfirm={() => {
            const result = actions.importBackup(confirm.text);
            setConfirm(null);
            notify(result.ok ? t('data.importDone') : t('data.importInvalid'), result.ok ? 'success' : 'error');
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
