import { create } from 'zustand'

export interface CartLine {
  product_id: number | null
  product_name: string
  unit_price_cents: number
  quantity: number
  category_id: number | null
  image: string | null
  stock: number
}

export interface CartProductInput {
  product_id: number | null
  product_name: string
  unit_price_cents: number
  category_id: number | null
  image: string | null
  stock: number
}

interface CartState {
  lines: CartLine[]
  add: (p: CartProductInput) => 'added' | 'incremented' | 'out-of-stock'
  increment: (key: string) => void
  decrement: (key: string) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

const keyOf = (l: CartLine): string => (l.product_id != null ? String(l.product_id) : l.product_name)

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  add: (p) => {
    const existing = get().lines.find((l) =>
      p.product_id != null ? l.product_id === p.product_id : l.product_name === p.product_name
    )
    if (existing) {
      if (existing.stock >= 0 && existing.quantity >= existing.stock) return 'out-of-stock'
      set((s) => ({
        lines: s.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
      }))
      return 'incremented'
    }
    set((s) => ({ lines: [...s.lines, { ...p, quantity: 1 }] }))
    return 'added'
  },
  increment: (key) =>
    set((s) => ({
      lines: s.lines.map((l) => {
        if (keyOf(l) !== key) return l
        if (l.stock >= 0 && l.quantity >= l.stock) return l
        return { ...l, quantity: l.quantity + 1 }
      })
    })),
  decrement: (key) =>
    set((s) => ({
      lines: s.lines
        .map((l) => (keyOf(l) === key ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    })),
  setQty: (key, qty) =>
    set((s) => ({
      lines: s.lines
        .map((l) => {
          if (keyOf(l) !== key) return l
          const next = Math.max(1, qty)
          return { ...l, quantity: l.stock >= 0 ? Math.min(next, l.stock) : next }
        })
        .filter((l) => l.quantity > 0)
    })),
  remove: (key) => set((s) => ({ lines: s.lines.filter((l) => keyOf(l) !== key) })),
  clear: () => set({ lines: [] })
}))

export function cartKey(l: CartLine): string {
  return keyOf(l)
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0)
}
