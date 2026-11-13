import { useCallback, useEffect, useState } from 'react'
import {
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Usb,
  FileText,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react'
import { Badge, Button, Modal, Select } from './ui'
import { useUi } from '../stores/ui'
import { useSettings } from '../stores/settings'
import { toast } from '../stores/toasts'
import { errMessage } from '../lib/errors'
import type { PrinterDeviceInfo, ReceiptPaperWidth } from '../../../shared/types'

export function PrintBillModal() {
  const saleId = useUi((s) => s.printingSaleId)
  const closePrintModal = useUi((s) => s.closePrintModal)
  const settings = useSettings((s) => s.settings)
  const updateSettings = useSettings((s) => s.update)

  const [printers, setPrinters] = useState<PrinterDeviceInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>('80mm')
  const [copies, setCopies] = useState<number>(1)
  const [receiptHtml, setReceiptHtml] = useState<string>('')
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [testing, setTesting] = useState(false)

  const loadPrinters = useCallback(async () => {
    setLoadingPrinters(true)
    try {
      const list = await window.api.devices.listPrinters()
      setPrinters(list)

      const savedPrinter = useSettings.getState().settings?.printer_device_name
      if (savedPrinter && list.some((p) => p.name === savedPrinter)) {
        setSelectedPrinter(savedPrinter)
      } else {
        const thermal = list.find((p) => p.isThermal)
        const def = list.find((p) => p.isDefault)
        const chosen = thermal ?? def ?? list[0]
        setSelectedPrinter(chosen?.name ?? '')
      }
    } catch (e) {
      toast.error('Could not detect printers', errMessage(e))
    } finally {
      setLoadingPrinters(false)
    }
  }, [])

  useEffect(() => {
    if (!saleId) return
    const savedWidth = settings?.receipt_paper_width ?? '80mm'
    setPaperWidth(savedWidth)
    setCopies(1)
    void loadPrinters()
  }, [saleId, settings?.receipt_paper_width, loadPrinters])

  useEffect(() => {
    if (!saleId) {
      setReceiptHtml('')
      return
    }
    let active = true
    window.api.devices
      .getReceiptHtml(saleId, paperWidth)
      .then((html) => {
        if (active) setReceiptHtml(html)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [saleId, paperWidth])

  const activeDevice = printers.find((p) => p.name === selectedPrinter) ?? null

  async function handlePrint(silentMode: boolean) {
    if (!saleId) return
    setPrinting(true)
    try {
      // Save preferred bill printer and paper width for future prints
      if (
        selectedPrinter !== (settings?.printer_device_name ?? '') ||
        paperWidth !== (settings?.receipt_paper_width ?? '80mm')
      ) {
        await updateSettings({
          printer_device_name: selectedPrinter || null,
          receipt_paper_width: paperWidth
        })
      }

      const res = await window.api.devices.printThermalReceipt({
        saleId,
        deviceName: selectedPrinter || null,
        paperWidth,
        silent: silentMode,
        copies
      })

      if (res.success) {
        toast.success(
          'Bill sent to printer',
          `Printed on ${activeDevice?.displayName || res.printerName || 'selected printer'} (${paperWidth})`
        )
        closePrintModal()
      } else if (res.error && res.error !== 'Print canceled') {
        toast.error('Print failed', res.error)
      }
    } catch (e) {
      toast.error('Print failed', errMessage(e))
    } finally {
      setPrinting(false)
    }
  }

  async function handleTestPrint() {
    setTesting(true)
    try {
      const res = await window.api.devices.testPrint(selectedPrinter || null, paperWidth)
      if (res.success) {
        toast.success('Test bill printed', `Sent to ${res.printerName}`)
      } else if (res.error && res.error !== 'Print canceled') {
        toast.error('Test print failed', res.error)
      }
    } catch (e) {
      toast.error('Test print failed', errMessage(e))
    } finally {
      setTesting(false)
    }
  }

  return (
    <Modal
      open={saleId !== null}
      onClose={closePrintModal}
      size="xl"
      title="Bill Printer & Receipt Output"
      description="Verify connected bill printer device details and print customer receipt."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestPrint}
              loading={testing}
              disabled={printing || !printers.length}
            >
              <Sparkles style={{ width: 14, height: 14 }} />
              Test Print
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePrint(false)}
              disabled={printing || testing}
              title="Open Windows / OS system print dialog"
            >
              <SlidersHorizontal style={{ width: 14, height: 14 }} />
              System Print Dialog…
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={closePrintModal} disabled={printing}>
              Cancel
            </Button>
            <Button onClick={() => handlePrint(true)} loading={printing}>
              <Printer style={{ width: 15, height: 15 }} />
              {activeDevice
                ? `Print on ${activeDevice.displayName.slice(0, 24)}`
                : 'Print Bill Now'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left column: Printer Selection & Device Details */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-app-muted">
              Select Connected Bill Printer
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadPrinters}
              loading={loadingPrinters}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw style={{ width: 13, height: 13 }} />
              Refresh Devices
            </Button>
          </div>

          {printers.length === 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle style={{ width: 16, height: 16 }} />
                No printer detected yet
              </div>
              <p className="mt-1 text-xs text-app-muted">
                Connect your USB thermal bill printer to the laptop and click{' '}
                <strong>Refresh Devices</strong>, or use <strong>System Print Dialog</strong>.
              </p>
            </div>
          ) : (
            <Select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
            >
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.displayName}
                  {p.isThermal ? ' ★ [Thermal Bill Printer]' : ''}
                  {p.isDefault ? ' (Default)' : ''}
                  {p.statusText !== 'Ready' ? ` — ${p.statusText}` : ''}
                </option>
              ))}
            </Select>
          )}

          {/* Device Hardware Details Card */}
          {activeDevice && (
            <div className="rounded-xl border border-app-border bg-app-surface2/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-app-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
                    <Printer style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-app-text">
                      {activeDevice.displayName}
                    </div>
                    <div className="font-mono text-[11px] text-app-faint">
                      ID: {activeDevice.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeDevice.isThermal && (
                    <Badge variant="brand">Thermal Bill Printer</Badge>
                  )}
                  <Badge variant={activeDevice.statusText === 'Ready' ? 'success' : 'warning'}>
                    <CheckCircle2 style={{ width: 11, height: 11 }} className="mr-1 inline" />
                    {activeDevice.statusText}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-lg border border-app-border/70 bg-app-bg/60 p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-app-faint">
                    <Cpu style={{ width: 12, height: 12 }} />
                    Driver / Model
                  </div>
                  <div className="mt-1 truncate font-medium text-app-text" title={activeDevice.driverModel}>
                    {activeDevice.driverModel || activeDevice.displayName}
                  </div>
                </div>

                <div className="rounded-lg border border-app-border/70 bg-app-bg/60 p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-app-faint">
                    <Usb style={{ width: 12, height: 12 }} />
                    Port / Connection
                  </div>
                  <div className="mt-1 truncate font-mono font-medium text-app-text" title={activeDevice.portOrUri}>
                    {activeDevice.portOrUri || 'USB / Local Spooler'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paper Roll Width & Copies */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-app-muted">
                Bill Paper Roll Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: '80mm', label: '80mm Roll', sub: '3" Thermal POS' },
                    { id: '58mm', label: '58mm Roll', sub: '2" Mini Bill' },
                    { id: 'A5', label: 'A5 Sheet', sub: 'Standard Counter' }
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaperWidth(opt.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left transition ${
                      paperWidth === opt.id
                        ? 'border-brand bg-brand/15 text-app-text'
                        : 'border-app-border bg-app-surface2/40 text-app-muted hover:border-app-borderStrong'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[10px] text-app-faint">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-app-muted">
                Copies
              </label>
              <div className="flex h-[52px] items-center justify-between rounded-lg border border-app-border bg-app-surface2/40 px-3">
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.max(1, c - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded bg-app-surface text-sm font-bold text-app-text hover:bg-app-border"
                >
                  -
                </button>
                <span className="font-mono text-sm font-semibold text-app-text">{copies}</span>
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.min(5, c + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded bg-app-surface text-sm font-bold text-app-text hover:bg-app-border"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Live Thermal Bill Preview */}
        <div className="flex flex-col lg:col-span-5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-app-muted">
              <FileText style={{ width: 13, height: 13 }} />
              Live Bill Preview ({paperWidth})
            </span>
          </div>
          <div className="flex h-[320px] items-start justify-center overflow-y-auto rounded-xl border border-app-border bg-zinc-900/70 p-3">
            {receiptHtml ? (
              <iframe
                title="Thermal Receipt Preview"
                srcDoc={receiptHtml}
                className="h-full rounded bg-white shadow-md transition-all"
                style={{
                  width: paperWidth === '58mm' ? '220px' : paperWidth === '80mm' ? '290px' : '100%',
                  minHeight: '290px',
                  border: 'none'
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-app-faint">
                Loading bill preview…
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
