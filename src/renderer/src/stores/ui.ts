import { create } from 'zustand'

interface UiState {
  addProductTick: number
  requestAddProduct: () => void
  consumeAddProductTick: () => void
  lowStockTick: number
  requestLowStock: () => void
  consumeLowStockTick: () => void
  reportTick: number
  requestReport: () => void
  consumeReportTick: () => void
}

export const useUi = create<UiState>((set) => ({
  addProductTick: 0,
  requestAddProduct: () => set((s) => ({ addProductTick: s.addProductTick + 1 })),
  consumeAddProductTick: () => set({ addProductTick: 0 }),
  lowStockTick: 0,
  requestLowStock: () => set((s) => ({ lowStockTick: s.lowStockTick + 1 })),
  consumeLowStockTick: () => set({ lowStockTick: 0 }),
  reportTick: 0,
  requestReport: () => set((s) => ({ reportTick: s.reportTick + 1 })),
  consumeReportTick: () => set({ reportTick: 0 }),
}))
