import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import en from './en.js'

/**
 * HOW TO ADD DARI OR PASHTO
 *  1. Copy src/i18n/en.js to src/i18n/fa.js (Dari) or ps.js (Pashto) and translate the values
 *     (keep the keys unchanged). Missing keys fall back to English automatically.
 *  2. Register the language below, e.g.  fa: { label: 'دری', dir: 'rtl', messages: fa }
 *  3. A language switcher appears in Settings as soon as there is more than one language,
 *     and the page direction (rtl/ltr) is applied automatically.
 */
export const LANGUAGES = {
  en: { label: 'English', dir: 'ltr', messages: en },
}

const LANG_KEY = 'smallbiz-manager.lang'

function readLang() {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v && LANGUAGES[v]) return v
  } catch {
    /* ignore */
  }
  return 'en'
}

export function translate(lang, key, params) {
  const msgs = LANGUAGES[lang]?.messages ?? en
  let s = msgs[key] ?? en[key] ?? key
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v))
  return s
}

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (k, p) => translate('en', k, p) })

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readLang)
  const setLang = (l) => {
    if (!LANGUAGES[l]) return
    setLangState(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = LANGUAGES[lang].dir
  }, [lang])
  const value = useMemo(() => ({ lang, setLang, t: (k, p) => translate(lang, k, p) }), [lang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
export const useT = () => useContext(LangContext).t
