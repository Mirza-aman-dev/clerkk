import { create } from 'zustand'
import type { AppSettings } from '../../../shared/types'

export type ThemeMode = 'dark' | 'light'

interface ThemeState {
  theme: ThemeMode
  apply: (t: ThemeMode) => void
  setTheme: (t: ThemeMode) => void
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'dark',
  apply: (t) => {
    set({ theme: t })
    document.documentElement.classList.toggle('dark', t === 'dark')
  },
  setTheme: (t) => {
    get().apply(t)
    window.api.settings.update({ theme: t }).catch(() => {})
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
}))

interface SettingsState {
  settings: AppSettings | null
  loaded: boolean
  loadError: string | null
  load: () => Promise<void>
  update: (partial: Partial<AppSettings>) => Promise<AppSettings>
}

let loadPromise: Promise<void> | null = null

export const useSettings = create<SettingsState>((set) => ({
  settings: null,
  loaded: false,
  loadError: null,
  load: async () => {
    // Return existing promise if load is already in progress
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      try {
        const settings = await window.api.settings.get()
        useTheme.getState().apply(settings.theme)
        set({ settings, loaded: true, loadError: null })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load settings'
        set({ settings: null, loaded: true, loadError: errorMsg })
        console.error('Failed to load settings:', err)
      } finally {
        loadPromise = null
      }
    })()

    return loadPromise
  },
  update: async (partial) => {
    const settings = await window.api.settings.update(partial)
    set({ settings })
    if (partial.theme) useTheme.getState().apply(partial.theme)
    return settings
  }
}))
