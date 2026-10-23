import type Database from 'better-sqlite3'
import { now } from './index'
import { getSetting, setSetting } from './settings'
import { createCategory } from './categories'
import { createProduct } from './products'
import { createCustomer } from './customers'
import { createSale, listSales } from './sales'
import { Product } from '../../shared/types'

export function seedIfNeeded(db: Database.Database): void {
  if (getSetting<boolean>('seeded', false)) return
  const count = (db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c
  if (count > 0) {
    setSetting('seeded', true)
    return
  }

  const groceries = createCategory('Groceries')
  const beverages = createCategory('Beverages')
  const dairy = createCategory('Dairy')
  const snacks = createCategory('Snacks')
  const household = createCategory('Household')
  const electronics = createCategory('Electronics')

  const defs: Array<[string, number, number, number, number, number]> = [
    // name, price_cents, cost_cents, stock, threshold, category_id
    ['Basmati Rice 5kg', 85000, 62000, 42, 8, groceries.id],
    ['Whole Wheat Atta 10kg', 52000, 41000, 18, 5, groceries.id],
    ['Sunflower Oil 1L', 14500, 11800, 36, 6, groceries.id],
    ['Toor Dal 1kg', 18000, 15200, 25, 5, groceries.id],
    ['Sugar 1kg', 4800, 4200, 4, 5, groceries.id],
    ['Tata Salt 1kg', 2800, 2300, 3, 5, groceries.id],
    ['Amul Milk 1L', 6600, 5600, 60, 12, dairy.id],
    ['Chai Masala Tea 500g', 26000, 20500, 15, 4, beverages.id],
    ['Cold Coffee 200ml', 3500, 2800, 80, 15, beverages.id],
    ['Potato Chips 90g', 2000, 1500, 6, 10, snacks.id],
    ['Biscuits 500g', 7000, 5500, 50, 10, snacks.id],
    ['Instant Noodles 70g', 1400, 1100, 120, 20, snacks.id],
    ['Dishwash Liquid 500ml', 9500, 7200, 22, 6, household.id],
    ['LED Bulb 9W', 11000, 8200, 30, 8, electronics.id],
    ['AA Batteries (4 pack)', 15000, 11800, 9, 5, electronics.id]
  ]

  const byName = new Map<string, Product>()
  defs.forEach(([name, price, cost, stock, threshold, cat], i) => {
    const p = createProduct({
      name,
      sku: `890${String(i + 1).padStart(7, '0')}`,
      price_cents: price,
      cost_cents: cost,
      stock,
      low_stock_threshold: threshold,
      category_id: cat
    })
    byName.set(name, p)
  })

  const rahul = createCustomer({ name: 'Rahul Sharma', phone: '9876543210', place: 'Mumbai' })
  const priya = createCustomer({ name: 'Priya Patel', phone: '9820012345', place: 'Pune' })
  const amit = createCustomer({ name: 'Amit Verma', phone: '9898989898', place: 'Delhi' })
  createCustomer({ name: 'Sneha Iyer', phone: '9000011111', place: 'Bengaluru' })

  const item = (name: string, qty: number) => {
    const p = byName.get(name)!
    return {
      product_id: p.id,
      product_name: p.name,
      unit_price_cents: p.price_cents,
      quantity: qty,
      category_id: p.category_id
    }
  }

  const sale1 = createSale({
    customer_id: rahul.id,
    payment_method: 'upi',
    notes: 'Home delivery',
    items: [item('Amul Milk 1L', 2), item('Sugar 1kg', 1), item('Biscuits 500g', 1)]
  })
  const sale2 = createSale({
    customer_id: null,
    payment_method: 'cash',
    notes: null,
    items: [item('Basmati Rice 5kg', 1), item('Toor Dal 1kg', 1)]
  })
  const sale3 = createSale({
    customer_id: priya.id,
    payment_method: 'card',
    notes: null,
    items: [item('Cold Coffee 200ml', 6), item('Potato Chips 90g', 3)]
  })
  const sale4 = createSale({
    customer_id: amit.id,
    payment_method: 'cash',
    notes: null,
    items: [item('LED Bulb 9W', 2), item('AA Batteries (4 pack)', 1), item('Dishwash Liquid 500ml', 1)]
  })

  // Backdate sales so charts/activity look organic.
  const backdate = db.prepare('UPDATE sales SET created_at = ? WHERE id = ?')
  const at = (daysAgo: number, hour: number, minute: number): string => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }
  backdate.run(at(0, 10, 12), sale1.id)
  backdate.run(at(1, 18, 45), sale2.id)
  backdate.run(at(2, 13, 5), sale3.id)
  backdate.run(at(4, 11, 30), sale4.id)

  // Curate activity log so first launch reads naturally.
  db.prepare('DELETE FROM activity_log').run()
  const activity = db.prepare('INSERT INTO activity_log (action, details, created_at) VALUES (?, ?, ?)')
  for (const s of listSales()) {
    activity.run('sale.complete', `Sale ${s.invoice_number} completed`, s.created_at)
  }
  activity.run('system.seed', 'Demo data loaded', now())

  setSetting('seeded', true)
}
