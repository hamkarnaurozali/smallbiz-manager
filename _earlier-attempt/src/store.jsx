// App state: loads from LocalStorage, applies ledger operations, saves after every successful change.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as ledger from './lib/ledger.js';
import { loadSampleData } from './lib/sampleData.js';
import { STORAGE_KEY, loadState, parseBackup, saveState } from './lib/storage.js';
import { todayISO } from './lib/dates.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const initial = useMemo(() => loadState(), []);
  const [state, setState] = useState(initial.state);
  const stateRef = useRef(initial.state);
  const [storageProblem, setStorageProblem] = useState(initial.notice === 'unavailable' ? 'unavailable' : null);
  const [loadNotice] = useState(initial.notice === 'corrupt' || initial.notice === 'dropped' ? { type: initial.notice, dropped: initial.dropped } : null);

  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
    const result = saveState(next);
    setStorageProblem(result.ok ? null : result.error);
    return result;
  }, []);

  // If the app is open in two tabs, pick up changes made in the other one instead of overwriting them.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const { state: fresh } = loadState();
      stateRef.current = fresh;
      setState(fresh);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const actions = useMemo(() => {
    const apply = (fn, ...args) => {
      const result = fn(stateRef.current, ...args, { today: todayISO() });
      if (result.ok) commit(result.state);
      return result;
    };
    const applyNoOpts = (fn, ...args) => {
      const result = fn(stateRef.current, ...args);
      if (result.ok) commit(result.state);
      return result;
    };
    return {
      addSale: (input) => apply(ledger.addSale, input),
      updateSale: (id, input) => apply(ledger.updateSale, id, input),
      deleteSale: (id, options) => applyNoOpts(ledger.deleteSale, id, options),
      addProduct: (input) => applyNoOpts(ledger.addProduct, input),
      updateProduct: (id, input) => applyNoOpts(ledger.updateProduct, id, input),
      deleteProduct: (id) => applyNoOpts(ledger.deleteProduct, id),
      addExpense: (input) => apply(ledger.addExpense, input),
      updateExpense: (id, input) => apply(ledger.updateExpense, id, input),
      deleteExpense: (id) => applyNoOpts(ledger.deleteExpense, id),
      loadSample: () => {
        const result = loadSampleData(stateRef.current, todayISO());
        if (result.ok) commit(result.state);
        return result;
      },
      removeSample: () => commit(ledger.removeSampleData(stateRef.current)),
      resetAll: () => commit(ledger.emptyState()),
      importBackup: (text) => {
        const result = parseBackup(text);
        if (!result.ok) return result;
        commit(result.state);
        return result;
      },
    };
  }, [commit]);

  const value = useMemo(() => ({ state, actions, storageProblem, loadNotice }), [state, actions, storageProblem, loadNotice]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
