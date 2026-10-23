import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button, Modal, Spinner } from './ui'
import { toast } from '../stores/toasts'
import { errMessage } from '../lib/errors'
import { formatDate } from '../../../shared/util'
import type { Sale } from '../../../shared/types'

export function InvoicePreview({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    setUrl(null)
    if (sale) {
      window.api.pdf
        .getInvoiceBuffer(sale.id)
        .then((buf) => {
          const blob = new Blob([buf as BlobPart], { type: 'application/pdf' })
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        })
        .catch((e) => toast.error('Could not load invoice', errMessage(e)))
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [sale])

  async function print() {
    if (!sale) return
    setBusy(true)
    try {
      await window.api.pdf.printInvoice(sale.id)
    } catch (e) {
      toast.error('Print failed', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!sale) return
    setBusy(true)
    try {
      const path = await window.api.pdf.saveInvoice(sale.id)
      if (path) toast.success('Saved', 'Invoice saved as PDF')
    } catch (e) {
      toast.error('Save failed', errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      size="lg"
      title={sale ? `Invoice ${sale.invoice_number}` : ''}
      description={sale ? formatDate(sale.created_at) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={save} loading={busy}>
            <Download style={{ width: 16, height: 16 }} />
            Save PDF
          </Button>
          <Button onClick={print} loading={busy}>
            <Printer style={{ width: 16, height: 16 }} />
            Print
          </Button>
        </>
      }
    >
      <div className="flex h-[68vh] items-center justify-center overflow-hidden rounded-xl border border-app-border bg-app-surface2">
        {url ? (
          <iframe src={url} className="h-full w-full" title="Invoice preview" />
        ) : (
          <Spinner />
        )}
      </div>
    </Modal>
  )
}
