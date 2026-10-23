import { useEffect, useMemo, useState } from 'react'
import { Pencil, Phone, Plus, Receipt, Search, Trash2, UserRound, Users } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Skeleton
} from '../../components/ui'
import { SaleCard } from '../../components/SaleCard'
import { InvoicePreview } from '../../components/InvoicePreview'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useMoney } from '../../hooks/useMoney'
import { toast } from '../../stores/toasts'
import { errMessage } from '../../lib/errors'
import { formatDateShort } from '../../../../shared/util'
import type { Customer, Sale } from '../../../../shared/types'

export function Customers() {
  const fmt = useMoney()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [busy, setBusy] = useState(false)

  const customers = useAsyncData(() => window.api.customers.list(search || undefined), [search])

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await window.api.customers.softDelete(deleting.id)
      toast.success('Customer deleted', deleting.name)
      customers.reload()
      setDeleting(null)
    } catch (e) {
      toast.error('Could not delete', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-app-border px-6 py-4">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint"
            style={{ width: 16, height: 16 }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="pl-9"
          />
        </div>
        <div className="ml-auto">
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Add customer
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
        {customers.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : customers.error ? (
          <EmptyState
            icon={Users}
            title="Could not load customers"
            description={customers.error}
            action={
              <Button variant="secondary" onClick={customers.reload}>
                Retry
              </Button>
            }
          />
        ) : !customers.data?.length ? (
          <EmptyState
            icon={Users}
            title={search ? 'No customers match' : 'No customers yet'}
            description={
              search ? 'Try a different search' : 'Add customers to track repeat business'
            }
            action={
              <Button
                onClick={() => {
                  setEditing(null)
                  setModalOpen(true)
                }}
              >
                <Plus style={{ width: 16, height: 16 }} />
                Add customer
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
            <div className="grid grid-cols-[minmax(0,1fr)_150px_140px_120px_90px_130px_92px] items-center gap-3 border-b border-app-border bg-app-surface2/60 px-4 py-3">
              {['Customer', 'Phone', 'Place', 'Total spent', 'Orders', 'Last purchase', ''].map(
                (h, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-semibold uppercase tracking-wide text-app-faint"
                  >
                    {h}
                  </span>
                )
              )}
            </div>
            {customers.data.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_150px_140px_120px_90px_130px_92px] items-center gap-3 border-b border-app-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-app-surface2/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <UserRound style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-app-text">{c.name}</p>
                    <p className="truncate text-xs text-app-faint">#{String(c.id).padStart(4, '0')}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 truncate text-sm text-app-muted">
                  <Phone style={{ width: 13, height: 13 }} />
                  {c.phone}
                </span>
                <span className="truncate text-sm text-app-muted">{c.place ?? '—'}</span>
                <span className="text-sm font-semibold text-app-text">{fmt(c.total_spent_cents)}</span>
                <span className="text-sm text-app-muted">{c.order_count}</span>
                <span className="text-xs text-app-faint">{formatDateShort(c.last_purchase || '')}</span>
                <div
                  className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconButton
                    title="Edit"
                    onClick={() => {
                      setEditing(c)
                      setModalOpen(true)
                    }}
                  >
                    <Pencil style={{ width: 16, height: 16 }} />
                  </IconButton>
                  <IconButton
                    title="Delete"
                    className="hover:bg-danger/10 hover:text-danger"
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 style={{ width: 16, height: 16 }} />
                  </IconButton>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <CustomerDetail
          customer={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected)
            setModalOpen(true)
          }}
        />
      )}

      <CustomerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        customer={editing}
        onSaved={() => {
          customers.reload()
          if (editing && selected?.id === editing.id) setSelected(null)
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={busy}
        danger
        title="Delete customer?"
        message={
          <>
            <strong>{deleting?.name}</strong> will be removed. Their past sales will be kept as
            walk-in records.
          </>
        }
        confirmLabel="Delete"
      />
    </div>
  )
}

function CustomerDetail({
  customer,
  onClose,
  onEdit
}: {
  customer: Customer
  onClose: () => void
  onEdit: () => void
}) {
  const fmt = useMoney()
  const sales = useAsyncData(() => window.api.sales.list({}), [])
  const [viewing, setViewing] = useState<Sale | null>(null)

  const orders = useMemo(
    () => (sales.data ?? []).filter((s) => s.customer_id === customer.id),
    [sales.data, customer.id]
  )

  async function printInvoice(sale: Sale) {
    try {
      await window.api.pdf.printInvoice(sale.id)
    } catch (e) {
      toast.error('Print failed', errMessage(e))
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={customer.name}
        description={`Customer #${String(customer.id).padStart(4, '0')}`}
        footer={
          <Button variant="secondary" onClick={onEdit}>
            <Pencil style={{ width: 16, height: 16 }} />
            Edit customer
          </Button>
        }
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-app-border bg-app-surface2/50 p-3.5">
            <p className="text-xs font-medium text-app-faint">Phone</p>
            <p className="mt-1 truncate text-sm font-semibold text-app-text">{customer.phone}</p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-surface2/50 p-3.5">
            <p className="text-xs font-medium text-app-faint">Place</p>
            <p className="mt-1 truncate text-sm font-semibold text-app-text">
              {customer.place ?? '—'}
            </p>
          </div>
          <div className="rounded-xl border border-app-border bg-app-surface2/50 p-3.5">
            <p className="text-xs font-medium text-app-faint">Total spent</p>
            <p className="mt-1 truncate text-sm font-semibold text-brand">
              {fmt(customer.total_spent_cents)}
            </p>
          </div>
        </div>

        <h4 className="mb-2 text-sm font-semibold text-app-text">
          Order history ({orders.length})
        </h4>
        {sales.loading ? (
          <Skeleton className="h-24" />
        ) : orders.length ? (
          <div className="space-y-3">
            {orders.map((s) => (
              <SaleCard key={s.id} sale={s} onView={setViewing} onPrint={printInvoice} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Receipt} title="No orders yet" description="This customer has not made any purchases" />
        )}
      </Modal>
      <InvoicePreview sale={viewing} onClose={() => setViewing(null)} />
    </>
  )
}

function CustomerModal({
  open,
  onClose,
  customer,
  onSaved
}: {
  open: boolean
  onClose: () => void
  customer: Customer | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [place, setPlace] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setName(customer?.name ?? '')
    setPhone(customer?.phone ?? '')
    setPlace(customer?.place ?? '')
    setErrors({})
  }, [open, customer])

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Name is required'
    if (!phone.trim()) next.phone = 'Phone number is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function save() {
    if (!validate()) return
    setBusy(true)
    try {
      const input = { name: name.trim(), phone: phone.trim(), place: place.trim() || null }
      if (customer) {
        await window.api.customers.update(customer.id, input)
        toast.success('Customer updated', input.name)
      } else {
        await window.api.customers.create(input)
        toast.success('Customer added', input.name)
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error('Could not save customer', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={customer ? 'Edit customer' : 'Add customer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {customer ? 'Save changes' : 'Add customer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" error={errors.name}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            invalid={!!errors.name}
            autoFocus
          />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
            inputMode="tel"
            invalid={!!errors.phone}
          />
        </Field>
        <Field label="Place / City">
          <Input
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="e.g. Mumbai"
          />
        </Field>
      </div>
    </Modal>
  )
}
