import { useCallback, useEffect, useState } from 'react'
import {
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ScanBarcode,
  SlidersHorizontal,
  Minus,
  Plus
} from 'lucide-react'
import { Badge, Button, Input, Modal, Select } from './ui'
import { useSettings } from '../stores/settings'
import { useMoney } from '../hooks/useMoney'
import { toast } from '../stores/toasts'
import { errMessage } from '../lib/errors'
import type { PrinterDeviceInfo, Product } from '../../../shared/types'

interface Props {
  product: Product | null
  onClose: () => void
}

export function PrintBarcodeModal({ product, onClose }: Props) {
  const fmt = useMoney()
  const settings = useSettings((s) => s.settings)
  const updateSettings = useSettings((s) => s.update)

  const [printers, setPrinters] = useState<PrinterDeviceInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')
  const [labelSize, setLabelSize] = useState<'25mm' | '26mm' | '26mm-narrow'>('25mm')
  const [copiesInput, setCopiesInput] = useState<string>('1')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [printing, setPrinting] = useState(false)

  const copies = Math.max(1, Math.min(500, parseInt(copiesInput, 10) || 1))

  const loadPrinters = useCallback(async () => {
    setLoadingPrinters(true)
    try {
      const list = await window.api.devices.listPrinters()
      setPrinters(list)

      const savedPrinter = useSettings.getState().settings?.printer_device_name
      const posiflow = list.find((p) =>
        /posiflow|psf20|psf-20|shreyans|tagsmart|taglite/i.test(
          `${p.name} ${p.displayName} ${p.driverModel}`
        )
      )
      if (posiflow) {
        setSelectedPrinter(posiflow.name)
      } else if (savedPrinter && list.some((p) => p.name === savedPrinter)) {
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
    if (!product) return
    setCopiesInput('1')
    setLabelSize('25mm')
    void loadPrinters()
  }, [product, loadPrinters])

  useEffect(() => {
    if (!product) {
      setPreviewHtml('')
      return
    }
    let active = true
    window.api.devices
      .getBarcodeLabelHtml(product.id, labelSize)
      .then((html) => {
        if (active) setPreviewHtml(html)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [product, labelSize])

  const activeDevice = printers.find((p) => p.name === selectedPrinter) ?? null

  async function handlePrint(silentMode: boolean) {
    if (!product) return
    setPrinting(true)
    try {
      if (selectedPrinter && selectedPrinter !== (settings?.printer_device_name ?? '')) {
        await updateSettings({ printer_device_name: selectedPrinter })
      }

      const res = await window.api.devices.printBarcodeLabels({
        productIds: [product.id],
        deviceName: selectedPrinter || null,
        labelSize,
        copies,
        silent: silentMode
      })

      if (res.success) {
        toast.success(
          `Printed ${copies} barcode ${copies === 1 ? 'label' : 'labels'}`,
          `${product.name} (${fmt(product.price_cents)}) → ${activeDevice?.displayName || res.printerName || 'POSiFLOW PSF20'}`
        )
        onClose()
      } else if (res.error && res.error !== 'Print canceled') {
        toast.error('Barcode print failed', res.error)
      }
    } catch (e) {
      toast.error('Barcode print failed', errMessage(e))
    } finally {
      setPrinting(false)
    }
  }

  const presetCounts = [1, 2, 5, 10, 20, 50]

  return (
    <Modal
      open={product !== null}
      onClose={onClose}
      size="lg"
      title="Print Product Barcode Labels"
      description={
        product
          ? `Print 25–26mm barcode stickers with Product Name, Barcode & Price for "${product.name}"`
          : ''
      }
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePrint(false)}
            disabled={printing}
            title="Open Windows system print dialog"
          >
            <SlidersHorizontal style={{ width: 14, height: 14 }} />
            System Print Dialog…
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={printing}>
              Cancel
            </Button>
            <Button onClick={() => handlePrint(true)} loading={printing}>
              <Printer style={{ width: 15, height: 15 }} />
              Print {copies} Barcode {copies === 1 ? 'Copy' : 'Copies'}
            </Button>
          </div>
        </div>
      }
    >
      {product && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          {/* Left: Copies Input & Printer Selection */}
          <div className="space-y-4 md:col-span-7">
            {/* Number of Copies Section */}
            <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-app-text">
                How many barcode copies needed?
              </label>
              <div className="mt-2.5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCopiesInput(String(Math.max(1, copies - 1)))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text transition hover:bg-app-surface2"
                >
                  <Minus style={{ width: 16, height: 16 }} />
                </button>
                <Input
                  value={copiesInput}
                  onChange={(e) => setCopiesInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handlePrint(true)
                    }
                  }}
                  inputMode="numeric"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  className="text-center font-mono text-lg font-bold"
                />
                <button
                  type="button"
                  onClick={() => setCopiesInput(String(Math.min(500, copies + 1)))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text transition hover:bg-app-surface2"
                >
                  <Plus style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* Quick Copy Presets */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] text-app-faint">Quick select:</span>
                {presetCounts.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCopiesInput(String(n))}
                    className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition ${
                      copies === n
                        ? 'border-brand bg-brand text-white'
                        : 'border-app-border bg-app-surface text-app-muted hover:border-brand/50 hover:text-app-text'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {product.stock > 0 && !presetCounts.includes(product.stock) && (
                  <button
                    type="button"
                    onClick={() => setCopiesInput(String(product.stock))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      copies === product.stock
                        ? 'border-brand bg-brand text-white'
                        : 'border-app-border bg-app-surface text-app-muted hover:border-brand/50 hover:text-app-text'
                    }`}
                  >
                    Stock ({product.stock})
                  </button>
                )}
              </div>
            </div>

            {/* Label Paper Size Selection */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-app-muted">
                Label Paper Size (POSiFLOW PSF20 · 25–26mm Roll)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: '25mm', label: '25mm Label', sub: '50 × 25mm Sticker' },
                    { id: '26mm', label: '26mm Label', sub: '50 × 26mm Sticker' },
                    { id: '26mm-narrow', label: '26mm Narrow', sub: '26 × 26mm Tag' }
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLabelSize(opt.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      labelSize === opt.id
                        ? 'border-brand bg-brand/15 text-app-text'
                        : 'border-app-border bg-app-surface2/40 text-app-muted hover:border-app-borderStrong'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-app-faint">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Connected Printer Selection */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-app-muted">
                  Target Label Printer (POSiFLOW PSF20)
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadPrinters}
                  loading={loadingPrinters}
                  className="h-6 px-2 text-[11px]"
                >
                  <RefreshCw style={{ width: 12, height: 12 }} />
                  Refresh
                </Button>
              </div>

              {printers.length === 0 ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle style={{ width: 14, height: 14 }} />
                    No printer detected yet
                  </div>
                  <p className="mt-1 text-[11px] text-app-muted">
                    Connect your <strong>POSiFLOW PSF20</strong> via USB and click{' '}
                    <strong>Refresh</strong>.
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
                      {p.isThermal ? ' ★ [POSiFLOW / Thermal]' : ''}
                      {p.isDefault ? ' (Default)' : ''}
                      {p.statusText !== 'Ready' ? ` — ${p.statusText}` : ''}
                    </option>
                  ))}
                </Select>
              )}

              {activeDevice && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-app-border bg-app-surface2/50 px-3 py-2 text-xs">
                  <div className="truncate">
                    <span className="font-semibold text-app-text">{activeDevice.displayName}</span>
                    <span className="ml-2 font-mono text-[11px] text-app-faint">
                      {activeDevice.portOrUri}
                    </span>
                  </div>
                  <Badge variant={activeDevice.statusText === 'Ready' ? 'success' : 'warning'}>
                    <CheckCircle2 style={{ width: 11, height: 11 }} className="mr-1 inline" />
                    {activeDevice.statusText}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Right: Live 25–26mm Label Sticker Preview */}
          <div className="flex flex-col md:col-span-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-app-muted">
                <ScanBarcode style={{ width: 13, height: 13 }} />
                25–26mm Label Preview
              </span>
              <Badge variant="brand">
                {copies} {copies === 1 ? 'Sticker' : 'Stickers'}
              </Badge>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-app-border bg-zinc-900/75 p-4">
              {/* Die-cut sticker visual frame */}
              <div className="rounded-xl bg-stone-300/30 p-2.5 shadow-inner">
                <div className="overflow-hidden rounded-lg bg-white shadow-lg">
                  {previewHtml ? (
                    <iframe
                      title="25-26mm Barcode Sticker Preview"
                      srcDoc={previewHtml}
                      style={{
                        width: labelSize === '26mm-narrow' ? '130px' : '220px',
                        height: '115px',
                        border: 'none',
                        display: 'block'
                      }}
                    />
                  ) : (
                    <div className="flex h-[115px] w-[220px] items-center justify-center text-xs text-zinc-400">
                      Generating barcode…
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 w-full space-y-1 rounded-xl border border-app-border/60 bg-app-surface/80 p-2.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-app-faint">Product Name:</span>
                  <span className="max-w-[140px] truncate font-semibold text-app-text">
                    {product.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-faint">Barcode / SKU:</span>
                  <span className="font-mono font-semibold text-app-text">{product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-faint">Printed Price:</span>
                  <span className="font-bold text-brand">{fmt(product.price_cents)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
