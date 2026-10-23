import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileText,
  Loader2,
  Package,
  PackageMinus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload
} from 'lucide-react'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  Toggle
} from '../../components/ui'
import { ProductModal } from './ProductModal'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useMoney } from '../../hooks/useMoney'
import { useUi } from '../../stores/ui'
import { toast } from '../../stores/toasts'
import { errMessage } from '../../lib/errors'
import { cn } from '../../lib/cn'
import { parseCsv } from '../../lib/csv'
import { formatDateShort } from '../../../../shared/util'
import type { Product } from '../../../../shared/types'

type SortKey = 'name' | 'price' | 'stock' | 'updated_at'

function downloadText(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Products() {
  const fmt = useMoney()
  const addProductTick = useUi((s) => s.addProductTick)
  const consumeAddProductTick = useUi((s) => s.consumeAddProductTick)
  const lowStockTick = useUi((s) => s.lowStockTick)
  const consumeLowStockTick = useUi((s) => s.consumeLowStockTick)

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('updated_at')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')

  const [editing, setEditing] = useState<Product | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [brcOpen, setBrcOpen] = useState(false)
  const [brcGenerating, setBrcGenerating] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filter = useMemo(
    () => ({
      search: search || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
      low_stock_only: lowStockOnly,
      sort,
      dir
    }),
    [search, categoryId, lowStockOnly, sort, dir]
  )

  const products = useAsyncData(() => window.api.products.list(filter), [filter])
  const categories = useAsyncData(() => window.api.categories.list(), [])

  // Open add modal via F2 / quick action
  useEffect(() => {
    if (addProductTick > 0) {
      consumeAddProductTick()
      setEditing(null)
      setModalOpen(true)
    }
  }, [addProductTick, consumeAddProductTick])

  // Enable low-stock filter via quick action
  useEffect(() => {
    if (lowStockTick > 0) {
      consumeLowStockTick()
      setLowStockOnly(true)
    }
  }, [lowStockTick, consumeLowStockTick])

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setDir('asc')
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await window.api.products.softDelete(deleting.id)
      toast.success('Product deleted', deleting.name)
      products.reload()
      setDeleting(null)
    } catch (e) {
      toast.error('Could not delete', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleExport() {
    try {
      const csv = await window.api.products.exportCsv()
      downloadText(`products-${new Date().toISOString().slice(0, 10)}.csv`, csv)
      toast.success('Exported', 'Products exported as CSV')
    } catch (e) {
      toast.error('Export failed', errMessage(e))
    }
  }

  async function handleImportFile(file: File) {
    setBusy(true)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      const result = await window.api.products.importCsv(rows)
      products.reload()
      categories.reload()
      toast.success(
        'Import complete',
        `${result.created} added, ${result.updated} updated${result.errors.length ? `, ${result.errors.length} skipped` : ''}`
      )
      if (result.errors.length) {
        console.warn('Import errors:', result.errors)
      }
      setImportOpen(false)
    } catch (e) {
      toast.error('Import failed', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleBrcGenerate() {
    setBrcGenerating(true)
    try {
      const pdfBuffer = await window.api.products.generateBarcodesPdf()
      const uint8Array = new Uint8Array(pdfBuffer)
      const blob = new Blob([uint8Array], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `barcodes-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF generated', 'Barcode PDF downloaded')
    } catch (e) {
      toast.error('Failed to generate PDF', errMessage(e))
    } finally {
      setBrcGenerating(false)
      setBrcOpen(false)
    }
  }

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-app-faint transition-colors hover:text-app-text"
    >
      {label}
      {sort === k ? (
        dir === 'asc' ? (
          <ArrowUp style={{ width: 12, height: 12 }} />
        ) : (
          <ArrowDown style={{ width: 12, height: 12 }} />
        )
      ) : (
        <ArrowUpDown style={{ width: 12, height: 12 }} />
      )}
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-app-border px-6 py-4">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint"
            style={{ width: 16, height: 16 }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or barcode…"
            className="pl-9"
          />
        </div>
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-44"
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-app-border px-3 py-2 text-sm text-app-muted">
          <Toggle checked={lowStockOnly} onChange={setLowStockOnly} />
          Low stock
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload style={{ width: 16, height: 16 }} />
            Import
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <Download style={{ width: 16, height: 16 }} />
            Export
          </Button>
          <Button
            variant="secondary"
            onClick={() => setBrcOpen(true)}
            disabled={brcGenerating}
            className="gap-2"
          >
            {brcGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText style={{ width: 16, height: 16 }} />
                BRC
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Add product
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImportFile(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
        {products.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : products.error ? (
          <EmptyState
            icon={Package}
            title="Could not load products"
            description={products.error}
            action={
              <Button variant="secondary" onClick={products.reload}>
                Retry
              </Button>
            }
          />
        ) : !products.data?.length ? (
          <EmptyState
            icon={Package}
            title={lowStockOnly || search ? 'No products match' : 'No products yet'}
            description={
              lowStockOnly || search
                ? 'Try adjusting your search or filters'
                : 'Add your first product to get started'
            }
            action={
              <Button
                onClick={() => {
                  setEditing(null)
                  setModalOpen(true)
                }}
              >
                <Plus style={{ width: 16, height: 16 }} />
                Add product
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
            <div className="grid grid-cols-[minmax(0,1fr)_140px_120px_90px_120px_92px] items-center gap-3 border-b border-app-border bg-app-surface2/60 px-4 py-3">
              <SortHeader label="Product" k="name" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-app-faint">
                Category
              </span>
              <SortHeader label="Price" k="price" />
              <SortHeader label="Stock" k="stock" />
              <SortHeader label="Updated" k="updated_at" />
              <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-app-faint">
                Actions
              </span>
            </div>
            {products.data.map((p) => {
              const low = p.stock <= p.low_stock_threshold
              return (
                <div
                  key={p.id}
                  className="group grid grid-cols-[minmax(0,1fr)_140px_120px_90px_120px_92px] items-center gap-3 border-b border-app-border px-4 py-3 transition-colors last:border-b-0 hover:bg-app-surface2/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-app-surface2">
                      {p.image ? (
                        <img src={p.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="text-app-faint" style={{ width: 18, height: 18 }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-app-text">{p.name}</p>
                      <p className="truncate font-mono text-xs text-app-faint">{p.sku}</p>
                    </div>
                  </div>
                  <span className="truncate text-sm text-app-muted">
                    {p.category_name ?? '—'}
                  </span>
                  <span className="text-sm font-medium text-app-text">{fmt(p.price_cents)}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-semibold', low ? 'text-danger' : 'text-app-text')}>
                      {p.stock}
                    </span>
                    {low && <Badge variant="danger">Low</Badge>}
                  </div>
                  <span className="text-xs text-app-faint">{formatDateShort(p.updated_at)}</span>
                  <div className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                    <IconButton
                      title="Adjust stock"
                      onClick={() => setAdjusting(p)}
                    >
                      <PackageMinus style={{ width: 16, height: 16 }} />
                    </IconButton>
                    <IconButton
                      title="Edit"
                      onClick={() => {
                        setEditing(p)
                        setModalOpen(true)
                      }}
                    >
                      <Pencil style={{ width: 16, height: 16 }} />
                    </IconButton>
                    <IconButton
                      title="Delete"
                      className="hover:bg-danger/10 hover:text-danger"
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 style={{ width: 16, height: 16 }} />
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ProductModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          consumeAddProductTick()
        }}
        product={editing}
        categories={categories.data ?? []}
        onSaved={products.reload}
        onCategoryCreated={categories.reload}
      />

      <StockAdjust adjusting={adjusting} onClose={() => setAdjusting(null)} onSaved={products.reload} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={busy}
        danger
        title="Delete product?"
        message={
          <>
            <strong>{deleting?.name}</strong> will be removed from your catalog. Past sale records will
            be preserved.
          </>
        }
        confirmLabel="Delete"
      />

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        size="sm"
        title="Import products"
        description="Choose a CSV file with the Clerkk format"
        footer={
          <Button variant="secondary" onClick={() => setImportOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-app-muted">
            Columns: <span className="font-mono text-xs">Name, SKU/Barcode, Price, Cost, Stock, Category, Low Stock Threshold, Description</span>
          </p>
          <Button className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload style={{ width: 16, height: 16 }} />
            Choose CSV file
          </Button>
          <p className="text-xs text-app-faint">
            Use Export to get a correctly formatted template. A header row is optional.
          </p>
        </div>
      </Modal>

      <BrcModal
        open={brcOpen}
        onClose={() => setBrcOpen(false)}
        generating={brcGenerating}
        onGenerate={handleBrcGenerate}
      />
    </div>
  )
}

function BrcModal({
  open,
  onClose,
  generating,
  onGenerate
}: {
  open: boolean
  onClose: () => void
  generating: boolean
  onGenerate: () => Promise<void>
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Generate Barcode PDF"
      description="Generate a PDF with all product barcodes. Products without barcodes will have one generated automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={generating}>
            Close
          </Button>
          <Button
            onClick={onGenerate}
            loading={generating}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileText style={{ width: 16, height: 16 }} />
                Generate PDF
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-app-muted">
          This will generate a PDF with all product barcodes in a 2-column layout.
          Each barcode includes the product name, price below the barcode, and SKU.
        </p>
        <p className="text-xs text-app-faint">
          Products without barcodes will have one generated automatically.
        </p>
      </div>
    </Modal>
  )
}

function StockAdjust({
  adjusting,
  onClose,
  onSaved
}: {
  adjusting: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const [mode, setMode] = useState<'delta' | 'set'>('set')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (adjusting) {
      setValue(String(adjusting.stock))
      setMode('set')
    }
  }, [adjusting])

  async function save() {
    if (!adjusting) return
    const num = parseInt(value, 10)
    if (Number.isNaN(num)) return
    const delta = mode === 'set' ? num - adjusting.stock : num
    setBusy(true)
    try {
      const updated = await window.api.products.adjustStock(adjusting.id, delta)
      toast.success('Stock updated', `${updated.name} is now ${updated.stock}`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error('Could not adjust stock', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={!!adjusting}
      onClose={onClose}
      size="sm"
      title="Adjust stock"
      description={adjusting ? adjusting.name : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('set')}
            className={cn(
              'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              mode === 'set'
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-app-border text-app-muted hover:bg-app-surface2'
            )}
          >
            Set to value
          </button>
          <button
            onClick={() => {
              setMode('delta')
              setValue('0')
            }}
            className={cn(
              'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              mode === 'delta'
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-app-border text-app-muted hover:bg-app-surface2'
            )}
          >
            Add / remove
          </button>
        </div>
        <Field label={mode === 'set' ? 'New quantity' : 'Change (use negative to remove)'}>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9-]/g, ''))}
            inputMode="numeric"
            autoFocus
          />
        </Field>
        {adjusting && (
          <p className="text-xs text-app-faint">
            Current stock: <span className="font-medium text-app-muted">{adjusting.stock}</span>
          </p>
        )}
      </div>
    </Modal>
  )
}
