import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { CameraOff, RefreshCw, ScanLine } from 'lucide-react'
import { cn } from '../lib/cn'
import { useSettings } from '../stores/settings'
import { useScanner, type CameraDevice } from '../stores/scanner'
import { useCart } from '../stores/cart'
import { useNav } from '../stores/nav'
import { toast } from '../stores/toasts'
import { Button } from './ui'

function pickDefault(cams: CameraDevice[]): string | null {
  // Prefer built-in/internal cameras (FaceTime, Built-in, Internal, etc.)
  // Avoid iPhone/mobile/continuity cameras
  const builtIn = cams.find((c) => 
    /built.?in|internal|facetime|face.?time|integrated|webcam|default/i.test(c.label)
  )
  // Explicitly avoid mobile/external cameras
  const mobile = cams.find((c) => 
    /iphone|mobile|continuity|ipad|android|usb|external/i.test(c.label)
  )
  // If there's a clear built-in camera and it's not also detected as mobile, use it
  if (builtIn && !mobile?.id.includes(builtIn.id)) {
    return builtIn.id
  }
  // If there's a mobile camera but no built-in, try to find a non-mobile one
  if (mobile && !builtIn) {
    const nonMobile = cams.find((c) => !/iphone|mobile|continuity|ipad|android|usb|external/i.test(c.label))
    if (nonMobile) return nonMobile.id
  }
  // Fallback: prefer back/rear/environment (for mobile devices)
  const env = cams.find((c) => /back|rear|environment|face.*back/i.test(c.label))
  return env?.id ?? cams[cams.length - 1]?.id ?? null
}

export function Scanner({ className }: { className?: string }) {
  const settings = useSettings((s) => s.settings)
  const status = useScanner((s) => s.status)
  const setStatus = useScanner((s) => s.setStatus)
  const setDevices = useScanner((s) => s.setDevices)
  const activeDeviceId = useScanner((s) => s.activeDeviceId)
  const setActiveDevice = useScanner((s) => s.setActiveDevice)
  const reportScan = useScanner((s) => s.reportScan)
  const addToCart = useCart((s) => s.add)
  const setTab = useNav((s) => s.setTab)

  const [retryKey, setRetryKey] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const handleScanRef = useRef<(code: string) => void>(() => {})

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const product = await window.api.products.bySku(code)
        if (product) {
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
            toast.warning('Out of stock', `"${product.name}" has no available stock`)
          } else {
            toast.success('Added to cart', product.name)
          }
        } else {
          toast.warning('Product not found', `No product matches barcode ${code}`)
        }
      } catch {
        toast.error('Scan failed', 'Could not look up the scanned code')
      }
    },
    [settings, addToCart, setTab]
  )

  // Stable debounced scanner callback (identity preserved across re-renders).
  useEffect(() => {
    let lastCode: string | null = null
    let lastAt = 0
    handleScanRef.current = (code: string) => {
      const sens = settings?.scanner_sensitivity ?? 1200
      const now = Date.now()
      if (lastCode === code && now - lastAt < sens) return
      lastCode = code
      lastAt = now
      reportScan(code)
      void handleScan(code)
    }
  }, [handleScan, settings, reportScan])

  useEffect(() => {
    let cancelled = false
    const inst = new Html5Qrcode('clerkk-scanner')

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
        // Wait for video element to be ready and have dimensions
        await waitForVideoReady()
        await inst.start(
          target,
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (code) => handleScanRef.current(code),
          (err) => {
            // Ignore scan errors (no code found in frame)
          }
        )
        if (!cancelled) setStatus('active')
      } catch (err) {
        console.error('Scanner start error:', err)
        if (!cancelled) setStatus('denied')
      }
    }

    async function waitForVideoReady(): Promise<void> {
      return new Promise((resolve) => {
        const checkVideo = () => {
          const video = document.querySelector('#clerkk-scanner video') as HTMLVideoElement
          if (video && video.videoWidth > 0 && video.videoHeight > 0) {
            resolve()
          } else {
            setTimeout(checkVideo, 100)
          }
        }
        checkVideo()
      })
    }

    void boot()
    return () => {
      cancelled = true
      inst
        .stop()
        .catch(() => {})
        .finally(() => {
          try {
            inst.clear()
          } catch {
            /* ignore */
          }
        })
    }
  }, [activeDeviceId, retryKey, setActiveDevice, setDevices, setStatus])

  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-black', className)}>
      <div id="clerkk-scanner" className="h-full w-full" style={{ minHeight: '200px', minWidth: '200px' }} />
      {status === 'active' && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-emerald-300 backdrop-blur">
          <ScanLine className="h-3 w-3" style={{ width: 12, height: 12 }} />
          LIVE
        </span>
      )}
      {status !== 'active' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-app-surface2 p-2 text-center">
          {status === 'denied' ? (
            <>
              <CameraOff className="h-5 w-5 text-app-faint" style={{ width: 20, height: 20 }} />
              <p className="text-[10px] leading-tight text-app-muted">Camera blocked</p>
              <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => setRetryKey((k) => k + 1)}>
                <RefreshCw className="h-3 w-3" style={{ width: 12, height: 12 }} />
                Retry
              </Button>
            </>
          ) : (
            <>
              <CameraOff className="h-5 w-5 text-app-faint" style={{ width: 20, height: 20 }} />
              <p className="text-[10px] leading-tight text-app-muted">
                {status === 'no-camera' ? 'No camera' : 'Starting…'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
