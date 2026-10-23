import {
  LayoutDashboard,
  Moon,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sun,
  Users,
  type LucideIcon
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useNav, type Tab } from '../stores/nav'
import { useTheme } from '../stores/settings'
import { useCart, cartCount } from '../stores/cart'

const items: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { tab: 'sale', label: 'New Sale', icon: ShoppingCart },
  { tab: 'products', label: 'Products', icon: Package },
  { tab: 'history', label: 'Sales History', icon: ReceiptText },
  { tab: 'customers', label: 'Customers', icon: Users },
  { tab: 'settings', label: 'Settings', icon: Settings }
]

export function Sidebar() {
  const tab = useNav((s) => s.tab)
  const setTab = useNav((s) => s.setTab)
  const theme = useTheme((s) => s.theme)
  const toggle = useTheme((s) => s.toggle)
  const cartQty = useCart((s) => cartCount(s.lines))

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-app-border bg-app-surface">
      <div className="drag-region flex h-16 items-center gap-2.5 px-5 pt-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-indigo-500 text-white shadow-sm shadow-brand/30">
          <span className="text-lg font-bold">C</span>
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight text-app-text">Clerkk</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-app-faint">POS Suite</p>
        </div>
      </div>

      <nav className="no-drag mt-2 flex-1 space-y-1 overflow-y-auto px-3 scrollbar-thin">
        {items.map(({ tab: t, label, icon: Icon }) => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-app-muted hover:bg-app-surface2 hover:text-app-text'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
              )}
              <Icon className="h-[18px] w-[18px]" style={{ width: 18, height: 18 }} />
              <span className="flex-1 text-left">{label}</span>
              {t === 'sale' && cartQty > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-fg">
                  {cartQty}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="no-drag border-t border-app-border p-3">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-app-muted transition-colors hover:bg-app-surface2 hover:text-app-text"
        >
          {theme === 'dark' ? (
            <Moon className="h-[18px] w-[18px]" style={{ width: 18, height: 18 }} />
          ) : (
            <Sun className="h-[18px] w-[18px]" style={{ width: 18, height: 18 }} />
          )}
          {theme === 'dark' ? 'Dark mode' : 'Light mode'}
        </button>
        <p className="px-3 pt-2 text-[11px] text-app-faint">Clerkk v1.0.0</p>
      </div>
    </aside>
  )
}
