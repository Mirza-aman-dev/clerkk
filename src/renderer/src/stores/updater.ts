import { create } from 'zustand'
import type { UpdaterStatus, UpdateInfo, DownloadProgress, UpdateCheckResult } from '../../../shared/types'

interface UpdaterState {
  status: UpdaterStatus
  setStatus: (status: Partial<UpdaterStatus>) => void
  reset: () => void
  // Actions
  checkForUpdates: () => Promise<UpdateCheckResult>
  downloadUpdate: () => Promise<UpdateCheckResult>
  installUpdate: () => Promise<UpdateCheckResult>
  getStatus: () => Promise<UpdaterStatus>
  openReleaseNotes: () => Promise<void>
}

const initialStatus: UpdaterStatus = {
  checking: false,
  updateAvailable: false,
  updateDownloaded: false,
  updateInfo: null
}

export const useUpdater = create<UpdaterState>((set, get) => ({
  status: initialStatus,

  setStatus: (partial) => set((state) => ({
    status: { ...state.status, ...partial }
  })),

  reset: () => set({ status: initialStatus }),

  checkForUpdates: async () => {
    set((state) => ({ status: { ...state.status, checking: true } }))
    try {
      const result = await window.api.updater.checkForUpdates()
      if (result.success && result.updateInfo) {
        set((state) => ({
          status: {
            ...state.status,
            checking: false,
            updateAvailable: true,
            updateInfo: result.updateInfo
          }
        }))
      } else {
        set((state) => ({
          status: { ...state.status, checking: false, updateAvailable: false, updateInfo: null }
        }))
      }
      return result
    } catch (error) {
      const err = error as Error
      set((state) => ({ status: { ...state.status, checking: false } }))
      return { success: false, message: err.message }
    }
  },

  downloadUpdate: async () => {
    try {
      const result = await window.api.updater.downloadUpdate()
      return result
    } catch (error) {
      const err = error as Error
      return { success: false, message: err.message }
    }
  },

  installUpdate: async () => {
    try {
      const result = await window.api.updater.installUpdate()
      return result
    } catch (error) {
      const err = error as Error
      return { success: false, message: err.message }
    }
  },

  getStatus: async () => {
    const status = await window.api.updater.getStatus()
    set({ status })
    return status
  },

  openReleaseNotes: async () => {
    await window.api.updater.openReleaseNotes()
  }
}))

// Hook to initialize listeners
export function useUpdaterListeners(): void {
  // This would be called once in App.tsx to set up event listeners
  // For now, the main process broadcasts to all windows
}