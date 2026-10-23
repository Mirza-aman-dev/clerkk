import { useState } from 'react'
import { ChevronDown, Eye, Printer } from 'lucide-react'
import { Badge, Button, IconButton } from './ui'
import { useMoney } from '../hooks/useMoney'
import { cn } from '../lib/cn'
import { formatDate } from '../../../shared/util'
import type { Sale } from '../../../shared/types'

export function SaleCard({
  sale,
  onView,
  onPrint
}: {
  sale: Sale
  onView: (sale: Sale) => void
  onPrint: (sale: Sale) => void
}) {
  const fmt = useMoney()
  const [expanded, setExpanded] = useState(false)
  const itemCount = sale.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-4 transition-shadow hover:shadow-soft">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-app-text">{sale.invoice_number}</h3>
            <Badge variant="brand">{sale.payment_method?.toUpperCase() || 'CASH'}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-app-faint">{formatDate(sale.created_at)}</p>
          <p className="mt-1.5 text-sm text-app-muted">
            {sale.customer_name ? (
              <>
                {sale.customer_name}
                {sale.customer_phone && (
                  <span className="text-app-faint"> · {sale.customer_phone}</span>
                )}
              </>
            ) : (
              'Walk-in customer'
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-app-text">{fmt(sale.total_cents)}</p>
          <p className="text-xs text-app-faint">
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-app-border pt-3">
        <Button size="sm" variant="secondary" onClick={() => onView(sale)}>
          <Eye style={{ width: 14, height: 14 }} />
          View
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onPrint(sale)}>
          <Printer style={{ width: 14, height: 14 }} />
          Print
        </Button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-app-muted transition-colors hover:bg-app-surface2 hover:text-app-text"
        >
          {expanded ? 'Hide items' : `${sale.items.length} line items`}
          <ChevronDown
            className={cn('transition-transform', expanded && 'rotate-180')}
            style={{ width: 14, height: 14 }}
          />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-app-surface2/50 p-3 animate-fade-in">
          {sale.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between text-sm">
              <span className="min-w-0 flex-1 truncate pr-3 text-app-text">
                {it.product_name}
                <span className="text-app-faint"> × {it.quantity}</span>
              </span>
              <span className="font-medium text-app-muted">{fmt(it.line_total_cents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
