import { getDb, now, logActivity } from './index'
import { Product, ProductInput, ListProductsFilter, ImportResult } from '../../shared/types'
import { ean13CheckDigit, amountToCents } from '../../shared/util'
import * as bwipjs from 'bwip-js'
import { promises as fs } from 'fs'
import { join } from 'path'

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`

function mapProduct(row: Record<string, unknown>): Product {
  return row as unknown as Product
}

export function listProducts(filter?: ListProductsFilter): Product[] {
  const db = getDb()
  const clauses: string[] = ['p.is_deleted = 0']
  const params: unknown[] = []
  if (filter?.search) {
    clauses.push('(p.name LIKE ? OR p.sku LIKE ?)')
    const q = `%${filter.search}%`
    params.push(q, q)
  }
  if (filter?.category_id) {
    clauses.push('p.category_id = ?')
    params.push(filter.category_id)
  }
  if (filter?.low_stock_only) {
    clauses.push('p.stock <= p.low_stock_threshold')
  }
  const sortCol: Record<string, string> = {
    name: 'p.name COLLATE NOCASE',
    price: 'p.price_cents',
    stock: 'p.stock',
    updated_at: 'p.updated_at'
  }
  const col = sortCol[filter?.sort ?? 'updated_at'] ?? 'p.updated_at'
  const dir = filter?.dir === 'asc' ? 'ASC' : 'DESC'
  const sql = `${PRODUCT_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY ${col} ${dir}, p.id DESC`
  return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapProduct)
}

export function getProduct(id: number): Product | null {
  const row = getDb()
    .prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.is_deleted = 0`)
    .get(id) as Record<string, unknown> | undefined
  return row ? mapProduct(row) : null
}

export function bySku(sku: string): Product | null {
  const row = getDb()
    .prepare(`${PRODUCT_SELECT} WHERE p.sku = ? AND p.is_deleted = 0`)
    .get(sku.trim()) as Record<string, unknown> | undefined
  return row ? mapProduct(row) : null
}

function assertValid(input: ProductInput): void {
  if (!input.name?.trim()) throw new Error('Product name is required')
  if (!input.sku?.trim()) throw new Error('SKU / barcode is required')
  if (input.price_cents < 0) throw new Error('Price cannot be negative')
}

function applyProduct(
  id: number,
  input: ProductInput
): Product {
  const db = getDb()
  assertValid(input)
  const name = input.name.trim()
  const sku = input.sku.trim()
  const dup = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(sku, id) as
    | { id: number }
    | undefined
  if (dup) throw new Error(`SKU/barcode "${sku}" already exists`)
  db.prepare(
    `UPDATE products SET
      name = ?, sku = ?, price_cents = ?, cost_cents = ?, stock = ?,
      low_stock_threshold = ?, category_id = ?, image = ?, description = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    name,
    sku,
    input.price_cents,
    input.cost_cents ?? 0,
    input.stock ?? 0,
    input.low_stock_threshold ?? 5,
    input.category_id ?? null,
    input.image ?? null,
    input.description ?? null,
    now(),
    id
  )
  logActivity('product.update', `Updated product "${name}"`)
  return getProduct(id) as Product
}

export function createProduct(input: ProductInput): Product {
  const db = getDb()
  assertValid(input)
  const name = input.name.trim()
  const sku = input.sku.trim()
  const dup = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku) as
    | { id: number }
    | undefined
  if (dup) throw new Error(`SKU/barcode "${sku}" already exists`)
  const info = db
    .prepare(
      `INSERT INTO products
        (name, sku, price_cents, cost_cents, stock, low_stock_threshold, category_id, image, description, created_at, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .run(
      name,
      sku,
      input.price_cents,
      input.cost_cents ?? 0,
      input.stock ?? 0,
      input.low_stock_threshold ?? 5,
      input.category_id ?? null,
      input.image ?? null,
      input.description ?? null,
      now(),
      now()
    )
  logActivity('product.create', `Added product "${name}"`)
  return getProduct(Number(info.lastInsertRowid)) as Product
}

export function updateProduct(id: number, input: ProductInput): Product {
  return applyProduct(id, input)
}

export function softDeleteProduct(id: number): void {
  const p = getProduct(id)
  if (!p) return
  getDb().prepare('UPDATE products SET is_deleted = 1, updated_at = ? WHERE id = ?').run(now(), id)
  logActivity('product.delete', `Deleted product "${p.name}"`)
}

export function adjustStock(id: number, delta: number): Product {
  const p = getProduct(id)
  if (!p) throw new Error('Product not found')
  const newStock = p.stock + delta
  getDb().prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(newStock, now(), id)
  logActivity('product.stock', `Adjusted stock of "${p.name}" by ${delta >= 0 ? '+' : ''}${delta}`)
  return getProduct(id) as Product
}

export function generateSku(): string {
  const db = getDb()
  for (let i = 0; i < 100; i++) {
    const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
    const sku = base + ean13CheckDigit(base)
    const exists = db.prepare('SELECT 1 FROM products WHERE sku = ?').get(sku)
    if (!exists) return sku
  }
  // fallback: timestamp-based unique code
  const t = Date.now().toString().padStart(13, '0').slice(-13)
  return t
}

export function importCsv(rows: string[][]): ImportResult {
  const db = getDb()
  const result: ImportResult = { created: 0, updated: 0, errors: [] }
  // Detect & skip header row
  let start = 0
  if (rows.length > 0) {
    const first = rows[0].map((c) => c.trim().toLowerCase())
    if (first.includes('name') && first.includes('sku')) start = 1
  }

  const tx = db.transaction(() => {
    for (let i = start; i < rows.length; i++) {
      const r = rows[i]
      if (!r || r.every((c) => !String(c).trim())) continue
      const [name, sku, price, cost, stock, category, threshold, description] = r
      if (!name?.trim() || !sku?.trim()) {
        result.errors.push(`Row ${i + 1}: missing name or SKU`)
        continue
      }
      const priceCents = amountToCents(Number(price) || 0)
      const costCents = amountToCents(Number(cost) || 0)
      const qty = parseInt(String(stock ?? '0'), 10) || 0
      const th = parseInt(String(threshold ?? '5'), 10) || 5

      let categoryId: number | null = null
      if (category?.trim()) {
        const cat = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(category.trim()) as
          | { id: number }
          | undefined
        categoryId = cat?.id ?? null
        if (!cat) {
          const info = db.prepare('INSERT INTO categories (name, created_at) VALUES (?, ?)').run(category.trim(), now())
          categoryId = Number(info.lastInsertRowid)
        }
      }

      const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku.trim()) as
        | { id: number }
        | undefined
      const input: ProductInput = {
        name: name.trim(),
        sku: sku.trim(),
        price_cents: priceCents,
        cost_cents: costCents,
        stock: qty,
        low_stock_threshold: th,
        category_id: categoryId,
        description: description?.trim() || null
      }
      try {
        if (existing) {
          applyProduct(existing.id, input)
          result.updated++
        } else {
          createProduct(input)
          result.created++
        }
      } catch (e) {
        result.errors.push(`Row ${i + 1}: ${(e as Error).message}`)
      }
    }
  })
  tx()
  return result
}

export function exportCsv(): string {
  const products = listProducts({ sort: 'name', dir: 'asc' })
  const esc = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = ['Name,SKU/Barcode,Price,Cost,Stock,Category,Low Stock Threshold,Description']
  for (const p of products) {
    lines.push(
      [
        esc(p.name),
        esc(p.sku),
        (p.price_cents / 100).toFixed(2),
        (p.cost_cents / 100).toFixed(2),
        p.stock,
        esc(p.category_name ?? ''),
        p.low_stock_threshold,
        esc(p.description ?? '')
      ].join(',')
    )
  }
  return lines.join('\n')
}

// Get barcode folder path (Clerk Products folder on Desktop or Downloads)
async function getBarcodeFolder(): Promise<string> {
  const { app } = require('electron')
  const desktop = app.getPath('desktop')
  const downloads = app.getPath('downloads')
  const folderName = 'Clerk Products'
  
  // Try Desktop first, then Downloads
  for (const base of [desktop, downloads]) {
    const folder = join(base, folderName)
    try {
      await fs.mkdir(folder, { recursive: true })
      return folder
    } catch {
      // Try next location
    }
  }
  // Fallback to userData
  const { app: electronApp } = require('electron')
  const fallback = join(electronApp.getPath('userData'), folderName)
  await fs.mkdir(fallback, { recursive: true })
  return fallback
}

// Generate EAN-13 barcode image and save to folder
export async function generateBarcodeImage(productName: string, priceCents?: number): Promise<{ sku: string; filePath: string }> {
  const db = getDb()
  
  // Generate unique SKU (EAN-13)
  let sku = ''
  for (let i = 0; i < 100; i++) {
    const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
    const checkDigit = ean13CheckDigit(base)
    sku = base + checkDigit
    const exists = db.prepare('SELECT 1 FROM products WHERE sku = ?').get(sku)
    if (!exists) break
  }
  if (!sku) {
    // fallback: timestamp-based unique code
    const t = Date.now().toString().padStart(13, '0').slice(-13)
    sku = t.slice(0, 12) + ean13CheckDigit(t.slice(0, 12))
  }

  // Generate barcode image using bwip-js
  const pngBuffer = await bwipjs.toBuffer({
    bcid: 'ean13',
    text: sku,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
    textfont: 'Helvetica',
    fontsize: 12
  })

  // Save barcode image
  const folder = await getBarcodeFolder()
  const safeName = productName.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_')
  const priceStr = priceCents ? `_₹${(priceCents / 100).toFixed(2).replace('.', '-')}` : ''
  const fileName = `${safeName}${priceStr}_${sku}.png`
  const filePath = join(folder, fileName)
  
  await fs.writeFile(filePath, pngBuffer)
  
  return { sku, filePath }
}

// Generate barcode PDF for all products
export async function generateBarcodesPdf(): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default
  
  const products = listProducts({ sort: 'name', dir: 'asc' })
  
  // Generate missing barcodes
  for (const product of products) {
    if (!product.barcode_image) {
      try {
        const result = await generateBarcodeImage(product.name, product.price_cents)
        // Update product with barcode image path
        getDb().prepare('UPDATE products SET barcode_image = ? WHERE id = ?').run(result.filePath, product.id)
      } catch (e) {
        console.error(`Failed to generate barcode for ${product.name}:`, e)
      }
    }
  }
  
  // Reload products with updated barcode images
  const updatedProducts = listProducts({ sort: 'name', dir: 'asc' })
  
  // PDF generation
  const PDFDocument2 = (await import('pdfkit')).default
  const doc = new PDFDocument({ 
    layout: 'landscape',
    margins: { top: 40, bottom: 40, left: 40, right: 40 }
  })
  
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))
  
  const products2 = listProducts({ sort: 'name', dir: 'asc' })
  
  const margin = 40
  const cardWidth = 200
  const cardHeight = 200
  
  let y = 40
  
  for (let i = 0; i < products2.length; i++) {
    const product = products2[i]
    
    if (i > 0 && i % 2 === 0) {
      y += 230
      
      // Check if we need new page
      if (y + 200 > doc.page.height - 40) {
        doc.addPage()
        y = 40
      }
    }
    
    const col = i % 2
    const cardX = 40 + (col * 210)
    const cardY = y
    const cardWidth = 200
    const cardHeight = 200
    
    // Draw border
    doc.rect(col * 210 + 40, y, 200, 200).stroke()
    
    // Product name
    doc.fontSize(12).font('Helvetica-Bold')
    doc.text(product.name, 40 + (col * 210) + 10, y + 10, { width: 180 })
    
    // Barcode
    if (product.barcode_image) {
      try {
        const fs = require('fs')
        if (fs.existsSync(product.barcode_image)) {
          doc.image(product.barcode_image, 40 + (col * 210) + 10, y + 40, { width: 180 })
        }
      } catch (e) {
        // If barcode image not found, skip
      }
    }
    
    // Price below barcode
    doc.fontSize(14).font('Helvetica-Bold')
    const priceStr = `₹${(product.price_cents / 100).toFixed(2)}`
    doc.text(priceStr, 40 + (col * 210) + 10, y + 165, { width: 180, align: 'center' })
    
    // SKU below price
    doc.fontSize(8).font('Helvetica')
    doc.text(product.sku, 40 + (col * 210) + 10, y + 180, { width: 180, align: 'center' })
  }
  
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}