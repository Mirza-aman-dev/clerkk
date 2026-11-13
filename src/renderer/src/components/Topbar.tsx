import { Keyboard, ScanBarcode } from 'lucide-react'
import { Scanner } from './Scanner'
import { useNav } from '../stores/nav'
import { useScanner } from '../stores/scanner'
import { useSettings } from '../stores/settings'
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
  const setTab = useNav((s) => s.setTab)
  const usbScanners = useScanner((s) => s.usbScanners)
  const lastCode = useScanner((s) => s.lastCode)
  const lastCodeAt = useScanner((s) => s.lastCodeAt)
  const usbEnabled = useSettings((s) => s.settings?.usb_scanner_enabled !== false)

  const recentScan = lastCode && Date.now() - lastCodeAt < 10000

  return (
    <header className="drag-region relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-app-border bg-app-surface/70 px-4 backdrop-blur">
      {isMac && <div className="h-full w-[70px] shrink-0" />}
      <div className="flex items-center gap-2.5">
        <h1 className="text-[15px] font-semibold text-app-text">{titles[tab]}</h1>
      </div>

      <div className="no-drag flex items-center gap-2.5">
        <div className="hidden items-center gap-1.5 text-app-faint lg:flex">
          <Keyboard className="h-3.5 w-3.5" style={{ width: 14, height: 14 }} />
          <span className="text-[11px]">F1 Sale · F2 Product · Ctrl+P Print</span>
        </div>

        {/* USB Barcode Gun Status Pill */}
        <button
          type="button"
          onClick={() => setTab('settings')}
          title={
            usbScanners.length > 0
              ? `USB Barcode Scanner Connected: ${usbScanners.map((d) => d.name).join(', ')}`
              : 'USB Barcode Gun Listener Active (Plug & Play HID Ready)'
          }
          className="flex items-center gap-2 rounded-full border border-app-border bg-app-surface2/70 px-3 py-1.5 text-left transition hover:border-app-borderStrong hover:bg-app-surface2"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              !usbEnabled
                ? 'bg-app-faint'
                : usbScanners.length > 0 || recentScan
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                  : 'bg-emerald-500/80'
            }`}
          />
          <ScanBarcode className="h-3.5 w-3.5 text-app-muted" style={{ width: 14, height: 14 }} />
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-medium text-app-text">
              {!usbEnabled
                ? 'USB Gun Off'
                : usbScanners.length > 0
                  ? usbScanners[0].name.length > 18
                    ? `${usbScanners[0].name.slice(0, 18)}…`
                    : usbScanners[0].name
                  : 'USB Gun Ready'}
            </span>
            {lastCode && (
              <span className="mt-0.5 font-mono text-[9px] text-emerald-500">
                Last: {lastCode}
              </span>
            )}
          </div>
        </button>

        {/* Camera Scanner Widget */}
        <div className="flex items-center gap-2 rounded-full border border-app-border bg-app-surface2/60 py-1 pl-1.5 pr-2.5">
          <Scanner className="h-9 w-12" />
          <span className="text-[11px] font-medium text-app-muted">Cam</span>
        </div>
      </div>
    </header>
  )
}
