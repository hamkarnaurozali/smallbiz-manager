import { useEffect, useState } from 'react'
import { LanguageProvider } from './i18n/index.jsx'
import { StoreProvider } from './store/StoreContext.jsx'
import { ToastProvider } from './components/ui.jsx'
import Layout, { NAV } from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sales from './pages/Sales.jsx'
import Expenses from './pages/Expenses.jsx'
import Products from './pages/Products.jsx'
import Reports from './pages/Reports.jsx'
import SettingsPage from './pages/Settings.jsx'

const PAGES = { dashboard: Dashboard, sales: Sales, expenses: Expenses, products: Products, reports: Reports, settings: SettingsPage }

function useRoute() {
  const read = () => {
    const p = window.location.hash.replace(/^#\/?/, '')
    return NAV.some((n) => n.path === p) ? p : 'dashboard'
  }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export default function App() {
  const route = useRoute()
  const Page = PAGES[route]
  return (
    <LanguageProvider>
      <StoreProvider>
        <ToastProvider>
          <Layout route={route}>
            <Page />
          </Layout>
        </ToastProvider>
      </StoreProvider>
    </LanguageProvider>
  )
}
