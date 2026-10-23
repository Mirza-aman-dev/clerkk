import { getDb, now, logActivity } from './index'
import { Sale, SaleItem, SaleCreateInput, ListSalesFilter, ReportData } from '../../shared/types'
import { taxFromSubtotal } from '../../shared/util'
import { getSettings, getSetting, setSetting } from './settings'

const SALE_SELECT = `
  SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.place AS customer_place
  FROM sales s
  LEFT JOIN customers c ON c.id = s.customer_id
`

function mapSale(row: Record<string, unknown>): Sale {
  return row as unknown as Sale
}

function hydrateItems(sale: Sale): Sale {
  const items = getDb()
    .prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id')
    .all(sale.id) as SaleItem[]
  return { ...sale, items }
}

export function listSales(filter?: ListSalesFilter): Sale[] {
  const db = getDb()
  const clauses: string[] = ['s.is_voided = 0']
  const params: unknown[] = []
  if (filter?.search?.trim()) {
    clauses.push('(s.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)')
    const q = `%${filter.search.trim()}%`
    params.push(q, q, q)
  }
  if (filter?.from) {
    clauses.push('s.created_at >= ?')
    params.push(filter.from)
  }
  if (filter?.to) {
    clauses.push('s.created_at <= ?')
    params.push(filter.to)
  }
  const sql = `${SALE_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY s.created_at DESC, s.id DESC LIMIT 500`
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  const sales = rows.map(mapSale)
  const items = db.prepare('SELECT * FROM sale_items ORDER BY id').all() as SaleItem[]
  const bySale = new Map<number, SaleItem[]>()
  for (const it of items) {
    const list = bySale.get(it.sale_id) ?? []
    list.push(it)
    bySale.set(it.sale_id, list)
  }
  return sales.map((s) => ({ ...s, items: bySale.get(s.id) ?? [] }))
}

export function getSale(id: number): Sale | null {
  const row = getDb().prepare(`${SALE_SELECT} WHERE s.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return null
  return hydrateItems(mapSale(row))
}

function nextInvoiceNumber(): string {
  const settings = getSettings()
  const counter = getSetting<number>('invoice_counter', 0)
  const next = (Number.isFinite(counter) ? counter : 0) + 1
  setSetting('invoice_counter', next)
  const pad = String(next).padStart(5, '0')
  return `${settings.invoice_prefix}-${pad}`
}

export function createSale(input: SaleCreateInput): Sale {
  const db = getDb()
  const settings = getSettings()
  if (!input.items.length) throw new Error('Cart is empty')

  // Validate stock before mutating anything
  for (const item of input.items) {
    if (item.product_id != null) {
      const p = db.prepare('SELECT id, name, stock FROM products WHERE id = ? AND is_deleted = 0').get(item.product_id) as
        | { id: number; name: string; stock: number }
        | undefined
      if (!p) throw new Error(`Product "${item.product_name}" no longer exists`)
      if (p.stock - item.quantity < 0) {
        throw new Error(`Insufficient stock for "${p.name}" (${p.stock} left)`)
      }
    }
  }

  const subtotal = input.items.reduce((sum, it) => sum + it.unit_price_cents * it.quantity, 0)
  const tax = taxFromSubtotal(subtotal, settings.tax_rate)
  const total = subtotal + tax

  const result = db.transaction((): Sale => {
    const invoice = nextInvoiceNumber()
    const saleInfo = db
      .prepare(
        `INSERT INTO sales
          (invoice_number, customer_id, subtotal_cents, tax_cents, total_cents, payment_method, notes, created_at, is_voided)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
      )
      .run(invoice, input.customer_id, subtotal, tax, total, input.payment_method || 'cash', input.notes ?? null, now())
    const saleId = Number(saleInfo.lastInsertRowid)

    const insertItem = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, product_name, unit_price_cents, quantity, line_total_cents, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const deduct = db.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?')

    for (const item of input.items) {
      const lineTotal = item.unit_price_cents * item.quantity
      insertItem.run(
        saleId,
        item.product_id,
        item.product_name,
        item.unit_price_cents,
        item.quantity,
        lineTotal,
        item.category_id
      )
      if (item.product_id != null) {
        deduct.run(item.quantity, now(), item.product_id)
      }
    }

    logActivity('sale.complete', `Sale ${invoice} completed`)
    return hydrateItems(mapSale(db.prepare(`${SALE_SELECT} WHERE s.id = ?`).get(saleId) as Record<string, unknown>))
  })()

  return result
}

export function voidSale(id: number): void {
  const db = getDb()
  const sale = getSale(id)
  if (!sale || sale.is_voided) throw new Error('Sale not found or already voided')

  db.transaction(() => {
    const restore = db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?')
    for (const item of sale.items) {
      if (item.product_id != null) restore.run(item.quantity, now(), item.product_id)
    }
    db.prepare('UPDATE sales SET is_voided = 1 WHERE id = ?').run(id)
    logActivity('sale.void', `Voided sale ${sale.invoice_number}`)
  })()
}

export function lastVoidable(): Sale | null {
  const rows = listSales()
  const latest = rows[0]
  if (!latest) return null
  const age = Date.now() - new Date(latest.created_at).getTime()
  if (age > 5 * 60 * 1000) return null
  return latest
}

export function buildReport(from: string, to: string): ReportData {
  const sales = listSales({ from, to })
  const totalOrders = sales.length
  const totalRevenue = sales.reduce((s, x) => s + x.total_cents, 0)

  const map = new Map<string, { qty: number; unit_cents: number; line_total_cents: number }>()
  for (const sale of sales) {
    for (const it of sale.items) {
      const key = `${it.product_name}|${it.unit_price_cents}`
      const cur = map.get(key) ?? { qty: 0, unit_cents: it.unit_price_cents, line_total_cents: 0 }
      cur.qty += it.quantity
      cur.line_total_cents += it.line_total_cents
      map.set(key, cur)
    }
  }
  const items = Array.from(map.entries()).map(([key, v]) => {
    const [product] = key.split('|')
    return { product, qty: v.qty, unit_cents: v.unit_cents, line_total_cents: v.line_total_cents }
  })
  items.sort((a, b) => b.line_total_cents - a.line_total_cents)

  return {
    from,
    to,
    total_orders: totalOrders,
    total_revenue_cents: totalRevenue,
    average_order_cents: totalOrders ? Math.round(totalRevenue / totalOrders) : 0,
    items
  }
}

export function lastInvoiceBufferId(): number | null {
  const row = getDb()
    .prepare('SELECT id FROM sales WHERE is_voided = 0 ORDER BY created_at DESC, id DESC LIMIT 1')
    .get() as { id: number } | undefined
  return row?.id ?? null
}
