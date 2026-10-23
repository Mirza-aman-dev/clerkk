import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let seq = 0

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    const life = t.action ? 7000 : 4200
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), life)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
}))

export const toast = {
  success: (title: string, message?: string, action?: Toast['action']) =>
    useToasts.getState().push({ kind: 'success', title, message, action }),
  error: (title: string, message?: string) =>
    useToasts.getState().push({ kind: 'error', title, message }),
  info: (title: string, message?: string) =>
    useToasts.getState().push({ kind: 'info', title, message }),
  warning: (title: string, message?: string) =>
    useToasts.getState().push({ kind: 'warning', title, message })
}
