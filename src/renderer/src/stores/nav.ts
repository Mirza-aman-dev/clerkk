import { create } from 'zustand'

export type Tab = 'dashboard' | 'products' | 'sale' | 'history' | 'customers' | 'settings'

interface NavState {
  tab: Tab
  setTab: (t: Tab) => void
}

export const useNav = create<NavState>((set) => ({
  tab: 'dashboard',
  setTab: (tab) => set({ tab })
}))
