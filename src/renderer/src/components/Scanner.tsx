import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { CameraOff, RefreshCw, ScanLine } from 'lucide-react'
import { cn } from '../lib/cn'
import { useSettings } from '../stores/settings'
import { useScanner, type CameraDevice, type ScanSource } from '../stores/scanner'
import { useCart } from '../stores/cart'
import { useNav } from '../stores/nav'
import { toast } from '../stores/toasts'
import { Button } from './ui'

function playScannerBeep(success: boolean): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (success) {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1850, ctx.currentTime)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.09)
    } else {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.22)
    }
    setTimeout(() => {
      ctx.close().catch(() => {})
    }, 300)
  } catch {
    // Ignore audio context errors
  }
}

function clearBurstFromInput(el: HTMLInputElement | HTMLTextAreaElement, burstText: string): void {
  try {
    const current = el.value ?? ''
    const next = current.endsWith(burstText)
      ? current.slice(0, Math.max(0, current.length - burstText.length))
      : current.includes(burstText)
        ? current.replace(burstText, '')
        : ''
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (nativeSetter) {
      nativeSetter.call(el, next)
    } else {
      el.value = next
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } catch {
    // Ignore input cleanup errors
  }
}

function pickDefault(cams: CameraDevice[]): string | null {
  const builtIn = cams.find((c) =>
    /built.?in|internal|facetime|face.?time|integrated|webcam|default/i.test(c.label)
  )
  const mobile = cams.find((c) =>
    /iphone|mobile|continuity|ipad|android|usb|external/i.test(c.label)
  )
  if (builtIn && !mobile?.id.includes(builtIn.id)) {
    return builtIn.id
  }
  if (mobile && !builtIn) {
    const nonMobile = cams.find(
      (c) => !/iphone|mobile|continuity|ipad|android|usb|external/i.test(c.label)
    )
    if (nonMobile) return nonMobile.id
  }
  const env = cams.find((c) => /back|rear|environment|face.*back/i.test(c.label))
  return env?.id ?? cams[cams.length - 1]?.id ?? null
}

export function Scanner({ className }: { className?: string }) {
  const settings = useSettings((s) => s.settings)
  const status = useScanner((s) => s.status)
  const setStatus = useScanner((s) => s.setStatus)
  const setDevices = useScanner((s) => s.setDevices)
  const setUsbScanners = useScanner((s) => s.setUsbScanners)
  const activeDeviceId = useScanner((s) => s.activeDeviceId)
  const setActiveDevice = useScanner((s) => s.setActiveDevice)
  const reportScan = useScanner((s) => s.reportScan)
  const addToCart = useCart((s) => s.add)
  const setTab = useNav((s) => s.setTab)

  const [retryKey, setRetryKey] = useState(0)
  const handleScanRef = useRef<(code: string, source?: ScanSource) => void>(() => {})

  const handleScan = useCallback(
    async (rawCode: string, source: ScanSource = 'usb-gun') => {
      const code = rawCode.trim()
      if (!code) return
      const playSound = settings?.scanner_sound !== false
      try {
        const product = await window.api.products.bySku(code)
        if (product) {
          reportScan(code, source, product.name)
          const res = addToCart({
            product_id: product.id,
            product_name: product.name,
            unit_price_cents: product.price_cents,
            category_id: product.category_id,
            image: product.image,
            stock: product.stock
          })
          setTab('sale')
          if (res === 'out-of-stock') {
            if (playSound) playScannerBeep(false)
            toast.warning('Out of stock', `"${product.name}" has no available stock`)
          } else {
            if (playSound) playScannerBeep(true)
            toast.success(
              source === 'usb-gun' ? 'Scanned & added to sale' : 'Added to cart',
              `${product.name} (${product.sku})`
            )
          }
        } else {
          reportScan(code, source, null)
          if (playSound) playScannerBeep(false)
          toast.warning('Product not found', `No product matches barcode "${code}"`)
        }
      } catch {
        if (playSound) playScannerBeep(false)
        toast.error('Scan failed', 'Could not look up the scanned barcode')
      }
    },
    [settings?.scanner_sound, addToCart, setTab, reportScan]
  )

  // Stable debounced scanner callback (identity preserved across re-renders).
  useEffect(() => {
    let lastCode: string | null = null
    let lastAt = 0
    handleScanRef.current = (code: string, source: ScanSource = 'camera') => {
      const sens = source === 'usb-gun' ? 350 : (settings?.scanner_sensitivity ?? 1200)
      const now = Date.now()
      if (lastCode === code && now - lastAt < sens) return
      lastCode = code
      lastAt = now
      void handleScan(code, source)
    }
  }, [handleScan, settings?.scanner_sensitivity])

  // Poll connected USB Barcode Scanners so UI stays aware of hardware connection state
  useEffect(() => {
    let active = true
    const checkUsb = async () => {
      try {
        const scanners = await window.api.devices.listUsbScanners()
        if (active) setUsbScanners(scanners)
      } catch {
        // ignore
      }
    }
    void checkUsb()
    const timer = setInterval(checkUsb, 6000)
    const onFocus = () => void checkUsb()
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [setUsbScanners])

  // Global USB HID Barcode Gun Listener (Keyboard Wedge auto-detection)
  useEffect(() => {
    if (settings?.usb_scanner_enabled === false) return

    let buffer = ''
    let timestamps: number[] = []
    let resetTimer: ReturnType<typeof setTimeout> | null = null

    const resetBuffer = () => {
      buffer = ''
      timestamps = []
      if (resetTimer) {
        clearTimeout(resetTimer)
        resetTimer = null
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts with Ctrl / Meta / Alt
      if (e.ctrlKey || e.metaKey || e.altKey) {
        resetBuffer()
        return
      }

      const target = e.target as HTMLElement | null
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true

      // Allow explicit barcode input fields (e.g., SKU field in Add/Edit Product modal) to receive the scan text directly
      if (target instanceof HTMLElement && target.dataset.barcodePassthrough === 'true') {
        if (e.key === 'Enter') {
          e.preventDefault()
        }
        resetBuffer()
        return
      }

      const now = performance.now()
      const lastTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0
      const delta = timestamps.length > 0 ? now - lastTime : 0

      // If too much time passed since last keystroke, start a fresh buffer
      // Barcode guns emit keys every 5–50ms; allow up to 85ms when inside an input or 350ms when no input is focused
      const maxGap = isInput ? 75 : 350
      if (timestamps.length > 0 && delta > maxGap) {
        buffer = ''
        timestamps = []
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        const candidate = buffer.trim()
        if (candidate.length >= 4 && timestamps.length >= 4) {
          const totalDuration = timestamps[timestamps.length - 1] - timestamps[0]
          const avgGap = totalDuration / Math.max(1, timestamps.length - 1)

          // Hardware barcode gun bursts have very low average inter-key latency (<= 55ms)
          // When no input is focused, also accept slightly slower scans (<= 140ms avg)
          const isRapidBurst = isInput ? avgGap <= 55 : avgGap <= 140
          if (isRapidBurst) {
            e.preventDefault()
            e.stopPropagation()
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
              clearBurstFromInput(target, candidate)
            }
            resetBuffer()
            handleScanRef.current(candidate, 'usb-gun')
            return
          }
        }
        resetBuffer()
        return
      }

      if (e.key === 'Shift' || e.key === 'CapsLock' || e.key === 'NumLock') {
        return
      }

      if (e.key.length === 1) {
        buffer += e.key
        timestamps.push(now)
        if (resetTimer) clearTimeout(resetTimer)
        resetTimer = setTimeout(resetBuffer, 500)
      } else {
        resetBuffer()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      resetBuffer()
    }
  }, [settings?.usb_scanner_enabled])

  useEffect(() => {
    let cancelled = false
    let inst: Html5Qrcode | null = null

    async function boot() {
      let cams: CameraDevice[] = []
      try {
        cams = await Html5Qrcode.getCameras()
      } catch {
        if (!cancelled) setStatus('denied')
        return
      }
      if (cancelled) return
      setDevices(cams)
      if (!cams.length) {
        setStatus('no-camera')
        return
      }
      const saved = useSettings.getState().settings?.camera_device_id
      const candidate = activeDeviceId ?? saved ?? null
      const target =
        candidate && cams.some((c) => c.id === candidate) ? candidate : pickDefault(cams)
      if (!target) {
        setStatus('no-camera')
        return
      }
      setActiveDevice(target)
      try {
        setStatus('starting')
        inst = new Html5Qrcode('clerkk-scanner')
        await inst.start(
          target,
          {
            fps: 10,
            qrbox: { width: 160, height: 100 },
            aspectRatio: 1.333
          },
          (code) => handleScanRef.current(code, 'camera'),
          () => {
            // Ignore frame without barcode
          }
        )
        if (!cancelled) setStatus('active')
      } catch {
        if (!cancelled) setStatus('denied')
      }
    }

    void boot()
    return () => {
      cancelled = true
      if (inst) {
        const currentInst = inst
        currentInst
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              currentInst.clear()
            } catch {
              /* ignore */
            }
          })
      }
    }
  }, [activeDeviceId, retryKey, setActiveDevice, setDevices, setStatus])

  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-black', className)}>
      <div id="clerkk-scanner" className="h-full w-full" />
      {status === 'active' && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300 backdrop-blur">
          <ScanLine className="h-2.5 w-2.5" style={{ width: 10, height: 10 }} />
          CAM
        </span>
      )}
      {status !== 'active' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-app-surface2 p-1 text-center">
          {status === 'denied' ? (
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className="flex flex-col items-center justify-center gap-0.5 text-[9px] text-app-muted hover:text-app-text"
              title="Retry camera"
            >
              <RefreshCw className="h-3 w-3" style={{ width: 12, height: 12 }} />
              <span>Retry</span>
            </button>
          ) : (
            <CameraOff className="h-3.5 w-3.5 text-app-faint" style={{ width: 14, height: 14 }} />
          )}
        </div>
      )}
    </div>
  )
}
