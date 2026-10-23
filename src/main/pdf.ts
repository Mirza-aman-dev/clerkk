import { getSale, buildReport } from './db/sales'
import { getSettings } from './db/settings'
import { Sale, AppSettings, ReportData } from '../shared/types'
import { formatDate } from '../shared/util'

// pdfmake's server build is consumed via require to avoid its browser-only typings.
interface PdfDoc {
  on(event: 'data', cb: (chunk: Buffer) => void): this
  on(event: 'end', cb: () => void): this
  on(event: 'error', cb: (err: Error) => void): this
  end(): void
}

interface PdfPrinterInstance {
  createPdfKitDocument(doc: unknown, options?: Record<string, unknown>): PdfDoc
}

interface PdfPrinterClass {
  new (fonts: Record<string, unknown>): PdfPrinterInstance
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake') as PdfPrinterClass
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vfsFonts = require('pdfmake/build/vfs_fonts.js') as Record<string, string>

const BRAND = '#6366f1'
const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const FAINT = '#f1f5f9'

const PDF_SAFE_SYMBOL: Record<string, string> = {
  INR: 'Rs. ',
  USD: '$',
  EUR: '\u20ac',
  GBP: '\u00a3',
  AED: 'AED ',
  SAR: 'SAR ',
  JPY: '\u00a5',
  CAD: 'CA$',
  AUD: 'A$',
  SGD: 'S$',
  PKR: 'Rs. ',
  BDT: 'Tk ',
  LKR: 'Rs. ',
  NPR: 'Rs. '
}

function pdfMoney(cents: number, currency: string): string {
  const amount = (cents / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${PDF_SAFE_SYMBOL[currency] ?? `${currency} `}${amount}`
}

let printer: PdfPrinterInstance | null = null

function getPrinter(): PdfPrinterInstance {
  if (printer) return printer
  const toBuf = (b64: string) => Buffer.from(b64, 'base64')
  const fonts = {
    Roboto: {
      normal: toBuf(vfsFonts['Roboto-Regular.ttf']),
      bold: toBuf(vfsFonts['Roboto-Medium.ttf']),
      italics: toBuf(vfsFonts['Roboto-Italic.ttf']),
      bolditalics: toBuf(vfsFonts['Roboto-MediumItalic.ttf'])
    }
  }
  printer = new PdfPrinter(fonts)
  return printer
}

function generate(doc: unknown): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdfDoc = getPrinter().createPdfKitDocument(doc)
    const chunks: Buffer[] = []
    pdfDoc.on('data', (c) => chunks.push(c))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
}

const TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
  hLineColor: () => LINE,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 8,
  paddingBottom: () => 8
}

function businessHeader(settings: AppSettings): Record<string, unknown> {
  const left = []
  if (settings.logo) {
    left.push({ image: settings.logo, width: 56, margin: [0, 0, 0, 8] })
  }
  left.push({ text: settings.business_name || 'My Business', bold: true, fontSize: 18, color: INK })
  if (settings.address) left.push({ text: settings.address, fontSize: 9, color: MUTED, margin: [0, 2, 0, 0] })
  if (settings.phone || settings.email) {
    left.push({
      text: [settings.phone, settings.email ? `  ·  ${settings.email}` : ''].filter(Boolean).join('  ·  '),
      fontSize: 9,
      color: MUTED,
      margin: [0, 2, 0, 0]
    })
  }
  return { columns: [{ stack: left, width: '*' }] }
}

export async function buildInvoiceBuffer(saleId: number): Promise<Buffer> {
  const sale = getSale(saleId)
  if (!sale) throw new Error('Sale not found')
  const settings = getSettings()
  const doc = buildInvoiceDoc(sale, settings)
  return generate(doc)
}

function buildInvoiceDoc(sale: Sale, settings: AppSettings): Record<string, unknown> {
  const currency = settings.currency
  const customer = sale.customer_name ? sale : null

  const rows: Array<Array<Record<string, unknown>>> = [
    ['#', 'Item', 'Qty', 'Unit Price', 'Amount'].map((h) => ({
      text: h,
      bold: true,
      color: '#ffffff',
      fontSize: 9
    }))
  ]
  sale.items.forEach((it, i) => {
    rows.push([
      { text: String(i + 1), fontSize: 9, color: MUTED },
      { text: it.product_name, fontSize: 9, color: INK },
      { text: String(it.quantity), fontSize: 9, color: INK, alignment: 'center' },
      { text: pdfMoney(it.unit_price_cents, currency), fontSize: 9, color: INK, alignment: 'right' },
      { text: pdfMoney(it.line_total_cents, currency), fontSize: 9, color: INK, alignment: 'right' }
    ])
  })

  const doc = {
    pageSize: 'A5' as const,
    pageMargins: [32, 36, 32, 36] as [number, number, number, number],
    info: { title: `Invoice ${sale.invoice_number}`, author: settings.business_name || 'Clerkk' },
    content: [
      {
        columns: [
          {
            stack: [
              { text: settings.business_name || 'My Business', bold: true, fontSize: 15, color: INK },
              ...(settings.address ? [{ text: settings.address, fontSize: 8, color: MUTED }] : []),
              ...(settings.phone || settings.email
                ? [
                    {
                      text: [settings.phone, settings.email ? `  ·  ${settings.email}` : '']
                        .filter(Boolean)
                        .join('  ·  '),
                      fontSize: 8,
                      color: MUTED
                    }
                  ]
                : [])
            ],
            width: '*'
          },
          {
            stack: [
              { text: 'INVOICE', bold: true, fontSize: 16, color: BRAND, alignment: 'right' },
              { text: sale.invoice_number, fontSize: 9, color: INK, alignment: 'right' },
              { text: formatDate(sale.created_at), fontSize: 8, color: MUTED, alignment: 'right' }
            ],
            width: 'auto'
          }
        ]
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 355, y2: 0, lineWidth: 1, lineColor: BRAND }], margin: [0, 10, 0, 14] },
      {
        columns: [
          { stack: [{ text: 'Billed To', fontSize: 8, color: MUTED, bold: true }, { text: customer ? sale.customer_name : 'Walk-in Customer', fontSize: 10, color: INK, margin: [0, 3, 0, 0] }], width: '*' },
          { stack: [{ text: 'Payment Method', fontSize: 8, color: MUTED, bold: true, alignment: 'right' }, { text: (sale.payment_method || 'cash').toUpperCase(), fontSize: 10, color: INK, alignment: 'right', margin: [0, 3, 0, 0] }], width: '*' }
        ],
        margin: [0, 0, 0, 12]
      },
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto', 'auto', 'auto'],
          body: rows
        },
        layout: {
          ...TABLE_LAYOUT,
          fillColor: (rowIndex: number) => (rowIndex === 0 ? BRAND : rowIndex % 2 ? '#fafbff' : null)
        }
      },
      { margin: [0, 12, 0, 0], columns: [ { width: '*', text: '' }, { width: 'auto', table: { widths: ['auto', 'auto'], body: [
        [{ text: 'Subtotal', fontSize: 9, color: MUTED }, { text: pdfMoney(sale.subtotal_cents, currency), fontSize: 9, color: INK, alignment: 'right' }],
        [{ text: `Tax (${settings.tax_rate}%)`, fontSize: 9, color: MUTED }, { text: pdfMoney(sale.tax_cents, currency), fontSize: 9, color: INK, alignment: 'right' }],
        [{ text: 'Total', bold: true, fontSize: 11, color: INK }, { text: pdfMoney(sale.total_cents, currency), bold: true, fontSize: 11, color: BRAND, alignment: 'right' }]
      ] }, layout: TABLE_LAYOUT } ] },
      { text: settings.receipt_footer || 'Thank you for your business!', fontSize: 8, color: MUTED, alignment: 'center', italics: true, margin: [0, 16, 0, 0] }
    ],
    defaultStyle: { font: 'Roboto', fontSize: 9 }
  }
  return doc
}

export async function buildReportBuffer(from: string, to: string): Promise<Buffer> {
  const settings = getSettings()
  const report = buildReport(from, to)
  return generate(buildReportDoc(report, settings))
}

function buildReportDoc(report: ReportData, settings: AppSettings): Record<string, unknown> {
  const currency = settings.currency
  const rows: Array<Array<Record<string, unknown>>> = [
    ['Product', 'Qty Sold', 'Unit Price', 'Line Total'].map((h) => ({
      text: h,
      bold: true,
      color: '#ffffff',
      fontSize: 9
    }))
  ]
  for (const it of report.items) {
    rows.push([
      { text: it.product, fontSize: 9, color: INK },
      { text: String(it.qty), fontSize: 9, color: INK, alignment: 'center' },
      { text: pdfMoney(it.unit_cents, currency), fontSize: 9, color: INK, alignment: 'right' },
      { text: pdfMoney(it.line_total_cents, currency), fontSize: 9, color: INK, alignment: 'right' }
    ])
  }
  if (!report.items.length) {
    rows.push([{ text: 'No sales in the selected period', colSpan: 4, fontSize: 9, color: MUTED, alignment: 'center' }, {}, {}, {}])
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 44, 40, 44],
    info: { title: 'Sales Report', author: settings.business_name || 'Clerkk' },
    content: [
      businessHeader(settings),
      { text: 'Sales Report', bold: true, fontSize: 18, color: INK, margin: [0, 16, 0, 2] },
      {
        text: `${formatDate(report.from)}  →  ${formatDate(report.to)}`,
        fontSize: 9,
        color: MUTED,
        margin: [0, 0, 0, 14]
      },
      {
        columns: [
          { stack: [{ text: 'Total Orders', fontSize: 8, color: MUTED, bold: true }, { text: String(report.total_orders), fontSize: 18, bold: true, color: INK, margin: [0, 4, 0, 0] }], width: '*' },
          { stack: [{ text: 'Total Revenue', fontSize: 8, color: MUTED, bold: true }, { text: pdfMoney(report.total_revenue_cents, currency), fontSize: 18, bold: true, color: BRAND, margin: [0, 4, 0, 0] }], width: '*' },
          { stack: [{ text: 'Avg. Order Value', fontSize: 8, color: MUTED, bold: true }, { text: pdfMoney(report.average_order_cents, currency), fontSize: 18, bold: true, color: INK, margin: [0, 4, 0, 0] }], width: '*' }
        ],
        margin: [0, 0, 0, 16]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: rows
        },
        layout: {
          ...TABLE_LAYOUT,
          fillColor: (rowIndex: number) => (rowIndex === 0 ? BRAND : rowIndex % 2 ? '#fafbff' : null)
        }
      },
      { text: `Generated by ${settings.business_name || 'Clerkk'} · ${new Date().toLocaleString()}`, fontSize: 8, color: MUTED, alignment: 'center', margin: [0, 20, 0, 0] }
    ],
    defaultStyle: { font: 'Roboto', fontSize: 9 }
  }
}
