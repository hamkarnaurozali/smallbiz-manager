import { BarChart3, LayoutDashboard, Package, Receipt, Settings, ShoppingCart, Store } from 'lucide-react'
import { useT } from '../i18n/index.jsx'
import { Notice } from './ui.jsx'
import { useStore } from '../store/StoreContext.jsx'

export const NAV = [
  { path: 'dashboard', icon: LayoutDashboard, label: 'nav.dashboard' },
  { path: 'sales', icon: ShoppingCart, label: 'nav.sales' },
  { path: 'expenses', icon: Receipt, label: 'nav.expenses' },
  { path: 'products', icon: Package, label: 'nav.products' },
  { path: 'reports', icon: BarChart3, label: 'nav.reports' },
  { path: 'settings', icon: Settings, label: 'nav.settings' },
]

export default function Layout({ route, children }) {
  const t = useT()
  const { saveFailed } = useStore()
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">
            <Store size={20} />
          </span>
          <span>{t('app.name')}</span>
        </div>
        <nav aria-label={t('nav.main')}>
          {NAV.map(({ path, icon: Icon, label }) => (
            <a key={path} href={`#/${path}`} className={route === path ? 'active' : ''} aria-current={route === path ? 'page' : undefined}>
              <Icon size={19} />
              <span>{t(label)}</span>
            </a>
          ))}
        </nav>
        <p className="sidebar-foot">{t('app.localNote')}</p>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="brand-logo">
            <Store size={18} />
          </span>
          <strong>{t('app.name')}</strong>
        </header>
        <main id="content">
          {saveFailed && <Notice tone="warn">{t('app.saveFailed')}</Notice>}
          {children}
        </main>
      </div>
      <nav className="bottom-nav" aria-label={t('nav.main')}>
        {NAV.map(({ path, icon: Icon, label }) => (
          <a key={path} href={`#/${path}`} className={route === path ? 'active' : ''} aria-current={route === path ? 'page' : undefined}>
            <Icon size={20} />
            <span>{t(label)}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
