import { create } from 'zustand'

export type ScannerStatus = 'idle' | 'starting' | 'active' | 'denied' | 'error' | 'no-camera'

export interface CameraDevice {
  id: string
  label: string
}

interface ScannerState {
  status: ScannerStatus
  devices: CameraDevice[]
  activeDeviceId: string | null
  lastCode: string | null
  lastCodeAt: number
  setStatus: (s: ScannerStatus) => void
  setDevices: (d: CameraDevice[]) => void
  setActiveDevice: (id: string | null) => void
  reportScan: (code: string) => void
}

export const useScanner = create<ScannerState>((set) => ({
  status: 'idle',
  devices: [],
  activeDeviceId: null,
  lastCode: null,
  lastCodeAt: 0,
  setStatus: (status) => set({ status }),
  setDevices: (devices) => set({ devices }),
  setActiveDevice: (activeDeviceId) => set({ activeDeviceId }),
  reportScan: (code) => set({ lastCode: code, lastCodeAt: Date.now() })
}))
