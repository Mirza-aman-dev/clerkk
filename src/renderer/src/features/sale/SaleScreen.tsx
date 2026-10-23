import { useMemo, useState, type ReactNode } from 'react'
import {
  Minus,
  Package,
  Phone,
  Plus,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  UserCheck,
  X
} from 'lucide-react'
import { Badge, Button, ConfirmDialog, EmptyState, Input, Select } from '../../components/ui'
import { InvoicePreview } from '../../components/InvoicePreview'
import { useCart, cartSubtotal, cartCount, cartKey, type CartLine } from '../../stores/cart'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useMoney } from '../../hooks/useMoney'
import { useSettings } from '../../stores/settings'
import { toast } from '../../stores/toasts'
import { errMessage } from '../../lib/errors'
import { cn } from '../../lib/cn'
import { taxFromSubtotal } from '../../../../shared/util'
import type { Customer, Product, Sale } from '../../../../shared/types'

export function SaleScreen() {
  const fmt = useMoney()
  const settings = useSettings((s) => s.settings)
  const taxRate = settings?.tax_rate ?? 0

  const lines = useCart((s) => s.lines)
  const addToCart = useCart((s) => s.add)
  const increment = useCart((s) => s.increment)
  const decrement = useCart((s) => s.decrement)
  const remove = useCart((s) => s.remove)
  const clear = useCart((s) => s.clear)

  const [search, setSearch] = useState('')
  const products = useAsyncData(() => window.api.products.list({ search: search || undefined, sort: 'name', dir: 'asc' }), [search])

  // customer
  const [phone, setPhone] = useState('')
  const [existing, setExisting] = useState<Customer | null>(null)
  const [lookup, setLookup] = useState<'idle' | 'found' | 'new'>('idle')
  const [newName, setNewName] = useState('')
  const [newPlace, setNewPlace] = useState('')
  const [payment, setPayment] = useState('cash')
  const [notes, setNotes] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)

  const subtotal = useMemo(() => cartSubtotal(lines), [lines])
  const tax = taxFromSubtotal(subtotal, taxRate)
  const total = subtotal + tax
  const count = cartCount(lines)

  async function lookupCustomer() {
    const p = phone.trim()
    if (!p) {
      setExisting(null)
      setLookup('idle')
      return
    }
    const c = await window.api.customers.byPhone(p)
    if (c) {
      setExisting(c)
      setLookup('found')
    } else {
      setExisting(null)
      setLookup('new')
    }
  }

  function addLine(p: Product) {
    const res = addToCart({
      product_id: p.id,
      product_name: p.name,
      unit_price_cents: p.price_cents,
      category_id: p.category_id,
      image: p.image,
      stock: p.stock
    })
    if (res === 'out-of-stock') toast.warning('Out of stock', `"${p.name}" has no available stock`)
  }

  async function completeSale() {
    if (!lines.length) return
    setBusy(true)
    try {
      let customerId: number | null = existing?.id ?? null
      if (phone.trim() && lookup === 'new') {
        if (!newName.trim()) {
          toast.error('Customer name required', 'Enter a name for the new customer')
          setBusy(false)
          return
        }
        const created = await window.api.customers.create({
          name: newName.trim(),
          phone: phone.trim(),
          place: newPlace.trim() || null
        })
        customerId = created.id
      }
      const sale = await window.api.sales.create({
        customer_id: customerId,
        payment_method: payment,
        notes: notes.trim() || null,
        items: lines.map((l) => ({
          product_id: l.product_id,
          product_name: l.product_name,
          unit_price_cents: l.unit_price_cents,
          quantity: l.quantity,
          category_id: l.category_id
        }))
      })
      clear()
      setPhone('')
      setExisting(null)
      setLookup('idle')
      setNewName('')
      setNewPlace('')
      setNotes('')
      setPayment('cash')
      setConfirmOpen(false)
      setCompletedSale(sale)
      toast.success('Sale completed', `${sale.invoice_number} · ${fmt(sale.total_cents)}`, {
        label: 'Print again',
        onClick: () => void window.api.pdf.printInvoice(sale.id)
      })
    } catch (e) {
      toast.error('Sale failed', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Left: browse & add */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-app-border px-6 py-4">
          <div className="relative max-w-md flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint"
              style={{ width: 16, height: 16 }}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products to add…"
              className="pl-9"
            />
          </div>
          <div className="ml-auto flex items-center gap-2 text-app-faint">
            <ScanLine className="text-brand" style={{ width: 16, height: 16 }} />
            <span className="text-xs">Scan a barcode to add automatically</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
          {!products.data?.length && !products.loading ? (
            <EmptyState
              icon={Package}
              title="No products to sell"
              description="Add products in the Products tab first"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {products.data?.map((p) => {
                const low = p.stock <= p.low_stock_threshold
                return (
                  <button
                    key={p.id}
                    onClick={() => addLine(p)}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface text-left transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-soft"
                  >
                    <div className="flex h-24 items-center justify-center overflow-hidden bg-app-surface2">
                      {p.image ? (
                        <img src={p.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="text-app-faint" style={{ width: 26, height: 26 }} />
                      )}
                    </div>
                    <div className="flex-1 p-3">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-app-text">
                        {p.name}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-semibold text-brand">{fmt(p.price_cents)}</span>
                        {low ? (
                          <Badge variant="danger">{p.stock} left</Badge>
                        ) : (
                          <span className="text-xs text-app-faint">{p.stock} in stock</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: cart */}
      <aside className="flex w-[400px] shrink-0 flex-col border-l border-app-border bg-app-surface">
        <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-brand" style={{ width: 18, height: 18 }} />
            <h2 className="font-semibold text-app-text">Current Sale</h2>
            {count > 0 && (
              <Badge variant="brand">{count}</Badge>
            )}
          </div>
          {lines.length > 0 && (
            <button
              onClick={clear}
              className="text-xs font-medium text-app-faint transition-colors hover:text-danger"
            >
              Clear
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 scrollbar-thin">
          {lines.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={ShoppingCart}
                title="Cart is empty"
                description="Scan a barcode or tap a product to add it"
              />
            </div>
          ) : (
            <div className="divide-y divide-app-border">
              {lines.map((l) => (
                <CartLineRow
                  key={cartKey(l)}
                  line={l}
                  fmt={fmt}
                  onInc={() => increment(cartKey(l))}
                  onDec={() => decrement(cartKey(l))}
                  onRemove={() => remove(cartKey(l))}
                />
              ))}
            </div>
          )}

          {/* Customer */}
          <div className="mt-5 border-t border-app-border pt-4">
            <p className="mb-2 text-[13px] font-semibold text-app-text">Customer</p>
            <div className="relative">
              <Phone
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint"
                style={{ width: 15, height: 15 }}
              />
              <Input
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setExisting(null)
                  setLookup('idle')
                }}
                onBlur={lookupCustomer}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void lookupCustomer()
                  }
                }}
                placeholder="Phone number (optional)"
                inputMode="tel"
                className="pl-9"
              />
            </div>

            {lookup === 'found' && existing && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok animate-fade-in">
                <UserCheck style={{ width: 16, height: 16 }} />
                <span className="font-medium">{existing.name}</span>
                {existing.place && <span className="text-ok/70">· {existing.place}</span>}
              </div>
            )}

            {lookup === 'new' && (
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-surface2/50 p-3 animate-slide-up">
                <p className="text-xs font-medium text-app-muted">New customer — add their details</p>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Name"
                  autoFocus
                />
                <Input
                  value={newPlace}
                  onChange={(e) => setNewPlace(e.target.value)}
                  placeholder="Place / city (optional)"
                />
              </div>
            )}
          </div>

          {/* Payment & notes */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-app-border pt-4">
            <div>
              <p className="mb-2 text-[13px] font-semibold text-app-text">Payment</p>
              <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-app-text">Notes</p>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note"
              />
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-app-border bg-app-surface2/40 px-5 py-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-app-muted">
              <span>Subtotal</span>
              <span className="font-medium text-app-text">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-app-muted">
              <span>Tax ({taxRate}%)</span>
              <span className="font-medium text-app-text">{fmt(tax)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-app-border pt-2.5">
              <span className="font-semibold text-app-text">Total</span>
              <span key={total} className="text-2xl font-bold text-brand animate-scale-in">
                {fmt(total)}
              </span>
            </div>
          </div>
          <Button
            className="mt-3 w-full"
            size="lg"
            disabled={!lines.length}
            onClick={() => setConfirmOpen(true)}
          >
            Complete Sale
          </Button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={completeSale}
        loading={busy}
        title="Complete this sale?"
        confirmLabel="Confirm sale"
        message={
          <div className="space-y-1.5">
            <p>
              {count} item{count === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold text-app-text">{fmt(total)}</span>
            </p>
            <p className="text-app-faint">
              Customer:{' '}
              {existing
                ? existing.name
                : lookup === 'new' && newName.trim()
                  ? `${newName.trim()} (new)`
                  : 'Walk-in'}
            </p>
          </div>
        }
      />

      <InvoicePreview sale={completedSale} onClose={() => setCompletedSale(null)} />
    </div>
  )
}

function CartLineRow({
  line,
  fmt,
  onInc,
  onDec,
  onRemove
}: {
  line: CartLine
  fmt: (c: number) => string
  onInc: () => void
  onDec: () => void
  onRemove: () => void
}) {
  const [removing, setRemoving] = useState(false)
  return (
    <div className="group flex items-center gap-3 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-surface2">
        {line.image ? (
          <img src={line.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Package className="text-app-faint" style={{ width: 18, height: 18 }} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-app-text">{line.product_name}</p>
        <p className="text-xs text-app-faint">
          {fmt(line.unit_price_cents)} each
        </p>
        <div className="mt-1.5 flex items-center gap-1">
          <StepBtn onClick={onDec} disabled={line.quantity <= 1}>
            <Minus style={{ width: 13, height: 13 }} />
          </StepBtn>
          <span className="w-7 text-center text-sm font-semibold text-app-text">{line.quantity}</span>
          <StepBtn onClick={onInc}>
            <Plus style={{ width: 13, height: 13 }} />
          </StepBtn>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold text-app-text">
          {fmt(line.unit_price_cents * line.quantity)}
        </span>
        {removing ? (
          <button
            className="flex items-center gap-1 rounded-lg bg-danger/10 px-2 py-1 text-[11px] font-medium text-danger"
            onClick={() => {
              onRemove()
              setRemoving(false)
            }}
          >
            Confirm <Trash2 style={{ width: 12, height: 12 }} />
          </button>
        ) : (
          <button
            onClick={() => {
              setRemoving(true)
              setTimeout(() => setRemoving(false), 2500)
            }}
            className="text-app-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
            title="Remove"
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        )}
      </div>
    </div>
  )
}

function StepBtn({
  onClick,
  disabled,
  children
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-lg border border-app-border text-app-muted',
        'transition-colors hover:bg-app-surface3 hover:text-app-text disabled:opacity-40'
      )}
    >
      {children}
    </button>
  )
}
