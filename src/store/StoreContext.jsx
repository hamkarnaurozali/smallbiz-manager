import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as S from '../lib/store.js'
import { loadState, saveState } from '../lib/storage.js'
import { buildSample } from '../lib/sample.js'

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState)
  const ref = useRef(state)
  const [saveFailed, setSaveFailed] = useState(false)

  // Apply a pure transition against the LATEST state and return its result synchronously.
  const apply = useCallback((fn, ...args) => {
    const res = fn(ref.current, ...args)
    if (res.state !== ref.current) {
      ref.current = res.state
      setState(res.state)
    }
    return res
  }, [])

  useEffect(() => {
    setSaveFailed(!saveState(state))
  }, [state])

  const actions = useMemo(
    () => ({
      addProduct: (i) => apply(S.addProduct, i),
      updateProduct: (id, i) => apply(S.updateProduct, id, i),
      deleteProduct: (id) => apply(S.deleteProduct, id),
      addSale: (i) => apply(S.addSale, i),
      updateSale: (id, i) => apply(S.updateSale, id, i),
      deleteSale: (id) => apply(S.deleteSale, id),
      addExpense: (i) => apply(S.addExpense, i),
      updateExpense: (id, i) => apply(S.updateExpense, id, i),
      deleteExpense: (id) => apply(S.deleteExpense, id),
      loadSample: () => apply(S.loadSample, buildSample()),
      removeSample: () => apply(S.removeSample),
      resetAll: () => apply(S.resetAll),
    }),
    [apply],
  )

  const value = useMemo(() => ({ state, actions, saveFailed }), [state, actions, saveFailed])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
