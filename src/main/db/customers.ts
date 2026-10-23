import { getDb, now, logActivity } from './index'
import { Customer, CustomerInput } from '../../shared/types'
import { normalizePhone } from '../../shared/util'

const CUSTOMER_SELECT = `
  SELECT c.*,
    COALESCE(SUM(CASE WHEN s.is_voided = 0 THEN s.total_cents ELSE 0 END), 0) AS total_spent_cents,
    COUNT(CASE WHEN s.is_voided = 0 THEN 1 END) AS order_count,
    MAX(CASE WHEN s.is_voided = 0 THEN s.created_at END) AS last_purchase
  FROM customers c
  LEFT JOIN sales s ON s.customer_id = c.id
`

function mapCustomer(row: Record<string, unknown>): Customer {
  return row as unknown as Customer
}

export function listCustomers(search?: string): Customer[] {
  const db = getDb()
  let sql = `${CUSTOMER_SELECT} WHERE c.is_deleted = 0`
  const params: unknown[] = []
  if (search?.trim()) {
    sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)'
    const q = `%${search.trim()}%`
    params.push(q, q)
  }
  sql += ' GROUP BY c.id ORDER BY c.name COLLATE NOCASE'
  return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapCustomer)
}

export function getCustomer(id: number): Customer | null {
  const row = getDb()
    .prepare(`${CUSTOMER_SELECT} WHERE c.id = ? AND c.is_deleted = 0 GROUP BY c.id`)
    .get(id) as Record<string, unknown> | undefined
  return row ? mapCustomer(row) : null
}

export function byPhone(phone: string): Customer | null {
  const norm = normalizePhone(phone)
  if (!norm) return null
  const rows = listCustomers()
  return rows.find((c) => normalizePhone(c.phone) === norm) ?? null
}

function assertValid(input: CustomerInput): void {
  if (!input.name?.trim()) throw new Error('Customer name is required')
  if (!normalizePhone(input.phone)) throw new Error('A valid phone number is required')
}

export function createCustomer(input: CustomerInput): Customer {
  const db = getDb()
  assertValid(input)
  const name = input.name.trim()
  const phone = input.phone.trim()
  const dup = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone) as
    | { id: number }
    | undefined
  if (dup) throw new Error(`A customer with phone "${phone}" already exists`)
  const info = db
    .prepare('INSERT INTO customers (name, phone, place, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, 0)')
    .run(name, phone, input.place?.trim() || null, now(), now())
  logActivity('customer.create', `Added customer "${name}"`)
  return getCustomer(Number(info.lastInsertRowid)) as Customer
}

export function updateCustomer(id: number, input: CustomerInput): Customer {
  const db = getDb()
  assertValid(input)
  const name = input.name.trim()
  const phone = input.phone.trim()
  const dup = db.prepare('SELECT id FROM customers WHERE phone = ? AND id != ?').get(phone, id) as
    | { id: number }
    | undefined
  if (dup) throw new Error(`A customer with phone "${phone}" already exists`)
  db.prepare('UPDATE customers SET name = ?, phone = ?, place = ?, updated_at = ? WHERE id = ?').run(
    name,
    phone,
    input.place?.trim() || null,
    now(),
    id
  )
  logActivity('customer.update', `Updated customer "${name}"`)
  return getCustomer(id) as Customer
}

export function softDeleteCustomer(id: number): void {
  const c = getCustomer(id)
  if (!c) return
  getDb().prepare('UPDATE customers SET is_deleted = 1, updated_at = ? WHERE id = ?').run(now(), id)
  logActivity('customer.delete', `Deleted customer "${c.name}"`)
}
