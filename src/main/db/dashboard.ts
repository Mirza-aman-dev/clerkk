import { getDb } from './index'
import { DashboardStats } from '../../shared/types'
import { listProducts } from './products'
import { listCustomers } from './customers'
import { listActivity } from './activity'

interface SumRow {
  t: number
  c: number
}

interface SaleRow {
  created_at: string
  total_cents: number
}

export function dashboardStats(): DashboardStats {
  const db = getDb()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  const revenueRow = db
    .prepare('SELECT COALESCE(SUM(total_cents),0) AS t, COUNT(*) AS c FROM sales WHERE is_voided = 0')
    .get() as SumRow
  const todayRow = db
    .prepare(
      'SELECT COALESCE(SUM(total_cents),0) AS t, COUNT(*) AS c FROM sales WHERE is_voided = 0 AND created_at >= ?'
    )
    .get(todayIso) as SumRow

  const products = listProducts()
  const productCount = products.length
  const lowStockCount = products.filter((p) => p.stock <= p.low_stock_threshold).length
  const customerCount = listCustomers().length

  // Revenue series — last 30 days, bucketed by local date.
  const days: Date[] = []
  const base = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  const startIso = days[0].toISOString()
  const salesRows = db
    .prepare('SELECT created_at, total_cents FROM sales WHERE is_voided = 0 AND created_at >= ?')
    .all(startIso) as SaleRow[]
  const buckets = new Map<string, number>()
  for (const d of days) buckets.set(d.toDateString(), 0)
  for (const s of salesRows) {
    const key = new Date(s.created_at).toDateString()
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + s.total_cents)
  }
  const revenue_series = days.map((d) => ({
    label: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
    cents: buckets.get(d.toDateString()) ?? 0
  }))

  const top_products = db
    .prepare(
      `SELECT si.product_name AS name, SUM(si.quantity) AS qty, SUM(si.line_total_cents) AS cents
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.is_voided = 0
       GROUP BY si.product_name
       ORDER BY qty DESC LIMIT 5`
    )
    .all() as DashboardStats['top_products']

  const category_sales = db
    .prepare(
      `SELECT COALESCE(c.name, 'Uncategorized') AS name, SUM(si.line_total_cents) AS cents
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN categories c ON c.id = si.category_id
       WHERE s.is_voided = 0
       GROUP BY COALESCE(c.name, 'Uncategorized')
       ORDER BY cents DESC`
    )
    .all() as DashboardStats['category_sales']

  return {
    total_revenue_cents: revenueRow.t,
    today_revenue_cents: todayRow.t,
    sales_count: revenueRow.c,
    today_sales_count: todayRow.c,
    product_count: productCount,
    low_stock_count: lowStockCount,
    customer_count: customerCount,
    revenue_series,
    top_products,
    category_sales,
    activity: listActivity(8)
  }
}
