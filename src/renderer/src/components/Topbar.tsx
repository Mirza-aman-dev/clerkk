import { Keyboard } from 'lucide-react'
import { Scanner } from './Scanner'
import { useNav } from '../stores/nav'
import { isMac } from '../lib/platform'

const titles: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  sale: 'New Sale',
  history: 'Sales History',
  customers: 'Customers',
  settings: 'Settings'
}

export function Topbar() {
  const tab = useNav((s) => s.tab)

  return (
    <header className="drag-region relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-app-border bg-app-surface/70 px-4 backdrop-blur">
      {isMac && <div className="h-full w-[70px] shrink-0" />}
      <div className="flex items-center gap-2.5">
        <h1 className="text-[15px] font-semibold text-app-text">{titles[tab]}</h1>
      </div>

      <div className="no-drag flex items-center gap-3">
        <div className="hidden items-center gap-1.5 text-app-faint md:flex">
          <Keyboard className="h-3.5 w-3.5" style={{ width: 14, height: 14 }} />
          <span className="text-[11px]">F1 Sale · F2 Product · Ctrl+P Print</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-app-border bg-app-surface2/60 py-1 pl-1.5 pr-2.5">
          <Scanner className="h-9 w-12" />
          <span className="text-[11px] font-medium text-app-muted">Scanner</span>
        </div>
      </div>
    </header>
  )
}
