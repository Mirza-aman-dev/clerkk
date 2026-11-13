import { create } from 'zustand'
import type { UsbScannerDeviceInfo } from '../../../shared/types'

export type ScannerStatus = 'idle' | 'starting' | 'active' | 'denied' | 'error' | 'no-camera'
export type ScanSource = 'usb-gun' | 'camera' | 'manual'

export interface CameraDevice {
  id: string
  label: string
}

interface ScannerState {
  status: ScannerStatus
  devices: CameraDevice[]
  usbScanners: UsbScannerDeviceInfo[]
  activeDeviceId: string | null
  lastCode: string | null
  lastCodeAt: number
  lastScanSource: ScanSource | null
  lastScannedProductName: string | null
  setStatus: (s: ScannerStatus) => void
  setDevices: (d: CameraDevice[]) => void
  setUsbScanners: (d: UsbScannerDeviceInfo[]) => void
  setActiveDevice: (id: string | null) => void
  reportScan: (code: string, source?: ScanSource, productName?: string | null) => void
}

export const useScanner = create<ScannerState>((set) => ({
  status: 'idle',
  devices: [],
  usbScanners: [],
  activeDeviceId: null,
  lastCode: null,
  lastCodeAt: 0,
  lastScanSource: null,
  lastScannedProductName: null,
  setStatus: (status) => set({ status }),
  setDevices: (devices) => set({ devices }),
  setUsbScanners: (usbScanners) => set({ usbScanners }),
  setActiveDevice: (activeDeviceId) => set({ activeDeviceId }),
  reportScan: (code, source = 'usb-gun', productName = null) =>
    set({
      lastCode: code,
      lastCodeAt: Date.now(),
      lastScanSource: source,
      lastScannedProductName: productName
    })
}))
