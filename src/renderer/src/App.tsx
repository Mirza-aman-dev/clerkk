import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { ToastHost } from './components/ui'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SplashScreen } from './components/SplashScreen'
import { SetupScreen } from './components/SetupScreen'
import { Footer } from './components/Footer'
import { useSettings } from './stores/settings'
import { useNav } from './stores/nav'
import { useUi } from './stores/ui'
import { toast } from './stores/toasts'
import { errMessage } from './lib/errors'
import { Dashboard } from './features/dashboard/Dashboard'
import { Products } from './features/products/Products'
import { SaleScreen } from './features/sale/SaleScreen'
import { History } from './features/history/History'
import { Customers } from './features/customers/Customers'
import { Settings } from './features/settings/Settings'

export function App() {
  const settings = useSettings((s) => s.settings)
  const loaded = useSettings((s) => s.loaded)
  const loadError = useSettings((s) => s.loadError)
  const load = useSettings((s) => s.load)
  const tab = useNav((s) => s.tab)
  const setTab = useNav((s) => s.setTab)
  const requestAddProduct = useUi((s) => s.requestAddProduct)

  const [splashDone, setSplashDone] = useState(false)
  const [setupDone, setSetupDone] = useState(() => localStorage.getItem('clerkk_setup_complete') === 'true')

  // Start loading settings immediately
  useEffect(() => {
    void load()
  }, [load])

  // Wait for settings to load (with minimum 2 second splash)
  useEffect(() => {
    let cancelled = false
    const startTime = Date.now()

    async function waitForLoad() {
      // Wait for settings to be loaded
      while (!loaded && !loadError && !cancelled) {
        await new Promise(r => setTimeout(r, 50))
      }

      // Ensure minimum 2 seconds
      const elapsed = Date.now() - startTime
      if (elapsed < 2000 && !cancelled) {
        await new Promise(r => setTimeout(r, 2000 - elapsed))
      }

      if (!cancelled) {
        setSplashDone(true)
      }
    }

    waitForLoad()

    return () => {
      cancelled = true
    }
  }, [loaded, loadError])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'F1') {
        e.preventDefault()
        setTab('sale')
      } else if (e.key === 'F2') {
        e.preventDefault()
        setTab('products')
        requestAddProduct()
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        window.api.sales
          .list({})
          .then((sales) => {
            if (sales[0]) return window.api.pdf.printInvoice(sales[0].id)
          })
          .catch((err) => toast.error('Print failed', errMessage(err)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTab, requestAddProduct])

  // Show splash screen until settings are actually loaded
  if (!splashDone) {
    return <SplashScreen onComplete={() => {}} />
  }

  // Check if settings load had an error
  if (loadError) {
    return (
      <ErrorBoundary>
        <div className="flex h-screen w-screen overflow-hidden bg-app-bg text-app-text">
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center p-8">
            <div className="max-w-md text-center">
              <h2 className="text-xl font-semibold text-app-text">Application Started with Issues</h2>
              <p className="mt-2 text-sm text-app-muted">Some features may not work correctly.</p>
              <p className="mt-4 text-xs text-app-faint font-mono break-all">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  // Show first-time setup screen
  if (!setupDone) {
    return (
      <SetupScreen
        onComplete={() => setSetupDone(true)}
      />
    )
  }

  if (!settings) return null // Should not happen after splash

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-screen overflow-hidden bg-app-bg text-app-text">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1">
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'products' && <Products />}
            {tab === 'sale' && <SaleScreen />}
            {tab === 'history' && <History />}
            {tab === 'customers' && <Customers />}
            {tab === 'settings' && <Settings />}
          </main>
          <Footer />
        </div>
        <ToastHost />
      </div>
    </ErrorBoundary>
  )
}
