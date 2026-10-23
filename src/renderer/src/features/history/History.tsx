import { useMemo, useState, useEffect } from 'react'
import { Download, FileText, Printer, ReceiptText, Search } from 'lucide-react'
import { Button, EmptyState, Field, Input, Modal, Skeleton } from '../../components/ui'
import { SaleCard } from '../../components/SaleCard'
import { InvoicePreview } from '../../components/InvoicePreview'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useMoney } from '../../hooks/useMoney'
import { useUi } from '../../stores/ui'
import { toast } from '../../stores/toasts'
import { errMessage } from '../../lib/errors'
import type { Sale } from '../../../../shared/types'

function dayStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toISOString()
}
function dayEnd(dateStr: string): string {
  const d = new Date(`${dateStr}T23:59:59.999`)
  return d.toISOString()
}
function lastNDaysIso(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export function History() {
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [viewing, setViewing] = useState<Sale | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const reportTick = useUi((s) => s.reportTick)
  const consumeReportTick = useUi((s) => s.consumeReportTick)

  useEffect(() => {
    if (reportTick > 0) {
      consumeReportTick()
      setReportOpen(true)
    }
  }, [reportTick, consumeReportTick])

  const filter = useMemo(
    () => ({
      search: search || undefined,
      from: from ? dayStart(from) : undefined,
      to: to ? dayEnd(to) : undefined
    }),
    [search, from, to]
  )
  const sales = useAsyncData(() => window.api.sales.list(filter), [filter])

  async function printInvoice(sale: Sale) {
    try {
      await window.api.pdf.printInvoice(sale.id)
    } catch (e) {
      toast.error('Print failed', errMessage(e))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-app-border px-6 py-4">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-faint"
            style={{ width: 16, height: 16 }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, customer, phone…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <span className="text-app-faint">→</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="ml-auto">
          <Button variant="secondary" onClick={() => setReportOpen(true)}>
            <FileText style={{ width: 16, height: 16 }} />
            Full sales report
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
        {sales.loading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : sales.error ? (
          <EmptyState
            icon={ReceiptText}
            title="Could not load sales"
            description={sales.error}
            action={
              <Button variant="secondary" onClick={sales.reload}>
                Retry
              </Button>
            }
          />
        ) : !sales.data?.length ? (
          <EmptyState
            icon={ReceiptText}
            title="No sales found"
            description="Completed sales will appear here"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {sales.data.map((s) => (
              <SaleCard key={s.id} sale={s} onView={setViewing} onPrint={printInvoice} />
            ))}
          </div>
        )}
      </div>

      <InvoicePreview sale={viewing} onClose={() => setViewing(null)} />
      <ReportModal open={reportOpen} onClose={() => { setReportOpen(false); consumeReportTick(); }} />
    </div>
  )
}

function ReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fmt = useMoney()
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)

  const fromIso = dayStart(from)
  const toIso = dayEnd(to)
  const report = useAsyncData(() => window.api.sales.report(fromIso, toIso), [fromIso, toIso])

  async function savePdf() {
    setBusy(true)
    try {
      const path = await window.api.pdf.saveReport(fromIso, toIso)
      if (path) toast.success('Report saved', 'Sales report saved as PDF')
    } catch (e) {
      toast.error('Save failed', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function printPdf() {
    setBusy(true)
    try {
      await window.api.pdf.printReport(fromIso, toIso)
    } catch (e) {
      toast.error('Print failed', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    if (!report.data) return
    const rows = ['Product,Qty Sold,Unit Price,Line Total']
    for (const it of report.data.items) {
      rows.push(
        [it.product, it.qty, (it.unit_cents / 100).toFixed(2), (it.line_total_cents / 100).toFixed(2)]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-report-${from}-to-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Sales report"
      description="Generate a professional PDF report for a period"
      footer={
        <>
          <Button variant="secondary" onClick={exportCsv} disabled={!report.data?.items.length}>
            <Download style={{ width: 16, height: 16 }} />
            CSV
          </Button>
          <Button variant="secondary" onClick={savePdf} loading={busy}>
            <Download style={{ width: 16, height: 16 }} />
            Save PDF
          </Button>
          <Button onClick={printPdf} loading={busy}>
            <Printer style={{ width: 16, height: 16 }} />
            Print
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <SummaryCard label="Total Orders" value={String(report.data?.total_orders ?? 0)} />
        <SummaryCard
          label="Total Revenue"
          value={fmt(report.data?.total_revenue_cents ?? 0)}
          accent
        />
        <SummaryCard label="Avg. Order" value={fmt(report.data?.average_order_cents ?? 0)} />
      </div>

      <div className="mt-5 max-h-64 overflow-y-auto rounded-xl border border-app-border scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-app-surface2">
            <tr className="text-left text-[11px] uppercase tracking-wide text-app-faint">
              <th className="px-4 py-2.5 font-semibold">Product</th>
              <th className="px-4 py-2.5 text-center font-semibold">Qty</th>
              <th className="px-4 py-2.5 text-right font-semibold">Line total</th>
            </tr>
          </thead>
          <tbody>
            {report.data?.items.map((it, i) => (
              <tr key={i} className="border-t border-app-border">
                <td className="px-4 py-2.5 text-app-text">{it.product}</td>
                <td className="px-4 py-2.5 text-center text-app-muted">{it.qty}</td>
                <td className="px-4 py-2.5 text-right font-medium text-app-text">
                  {fmt(it.line_total_cents)}
                </td>
              </tr>
            ))}
            {!report.data?.items.length && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-app-faint">
                  No sales in this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface2/50 p-4">
      <p className="text-xs font-medium text-app-faint">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? 'text-brand' : 'text-app-text'}`}>{value}</p>
    </div>
  )
}
