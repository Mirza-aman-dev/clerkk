import { ipcMain, app, shell, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'

import * as settingsRepo from './db/settings'
import * as categoriesRepo from './db/categories'
import * as productsRepo from './db/products'
import * as customersRepo from './db/customers'
import * as salesRepo from './db/sales'
import * as dashboardRepo from './db/dashboard'
import * as maintenance from './db/maintenance'
import { logActivity } from './db'
import { backupDatabase, restoreDatabase } from './files'
import { buildInvoiceBuffer, buildReportBuffer } from './pdf'
import {
  listPrinters,
  listUsbScanners,
  printThermalReceipt,
  getReceiptHtml,
  testPrint,
  printBarcodeLabels
} from './devices'
import type { PrintLabelsOptions, PrintReceiptOptions, ReceiptPaperWidth } from '../shared/types'

function parentOf(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  return BrowserWindow.fromWebContents(event.sender) as BrowserWindow
}

async function printPdfBuffer(buffer: Buffer): Promise<void> {
  const tmp = join(app.getPath('temp'), `clerkk-print-${Date.now()}.pdf`)
  await fs.writeFile(tmp, buffer)
  await new Promise<void>((resolve) => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      if (!win.isDestroyed()) win.destroy()
      fs.unlink(tmp).catch(() => {})
      resolve()
    }
    const timer = setTimeout(done, 60000)
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (finished || win.isDestroyed()) return
        win.webContents.print({ silent: false, printBackground: true }, () => {
          clearTimeout(timer)
          done()
        })
      }, 450)
    })
    win.loadURL(pathToFileURL(tmp).toString()).catch(() => {
      clearTimeout(timer)
      done()
    })
  })
}

export function registerIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:reveal', (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('settings:get', () => settingsRepo.getSettings())
  ipcMain.handle('settings:update', (_e, partial) => settingsRepo.updateSettings(partial))

  ipcMain.handle('categories:list', () => categoriesRepo.listCategories())
  ipcMain.handle('categories:create', (_e, name: string) => categoriesRepo.createCategory(name))
  ipcMain.handle('categories:delete', (_e, id: number) => categoriesRepo.deleteCategory(id))

  ipcMain.handle('products:list', (_e, filter) => productsRepo.listProducts(filter))
  ipcMain.handle('products:get', (_e, id: number) => productsRepo.getProduct(id))
  ipcMain.handle('products:bySku', (_e, sku: string) => productsRepo.bySku(sku))
  ipcMain.handle('products:create', (_e, input) => productsRepo.createProduct(input))
  ipcMain.handle('products:update', (_e, id: number, input) => productsRepo.updateProduct(id, input))
  ipcMain.handle('products:softDelete', (_e, id: number) => productsRepo.softDeleteProduct(id))
  ipcMain.handle('products:adjustStock', (_e, id: number, delta: number) =>
    productsRepo.adjustStock(id, delta)
  )
  ipcMain.handle('products:generateSku', () => productsRepo.generateSku())
  ipcMain.handle('products:importCsv', async (_e, rows: string[][]) => await productsRepo.importCsv(rows))
  ipcMain.handle('products:exportCsv', () => productsRepo.exportCsv())
  ipcMain.handle(
    'products:generateBarcodeImage',
    async (_e, productName: string, priceCents?: number, existingSku?: string) => {
      return await productsRepo.generateBarcodeImage(productName, priceCents, existingSku)
    }
  )
  ipcMain.handle('products:generateBarcodesPdf', async (_e, format?: '26mm-label' | 'a4-sheet') => {
    return await productsRepo.generateBarcodesPdf(format)
  })

  ipcMain.handle('devices:listPrinters', (e) => listPrinters(e.sender))
  ipcMain.handle('devices:listUsbScanners', () => listUsbScanners())
  ipcMain.handle('devices:printThermalReceipt', (_e, options: PrintReceiptOptions) =>
    printThermalReceipt(options)
  )
  ipcMain.handle('devices:getReceiptHtml', (_e, saleId: number, paperWidth?: ReceiptPaperWidth) =>
    getReceiptHtml(saleId, paperWidth)
  )
  ipcMain.handle(
    'devices:testPrint',
    (_e, deviceName?: string | null, paperWidth?: ReceiptPaperWidth) =>
      testPrint(deviceName, paperWidth)
  )
  ipcMain.handle('devices:printBarcodeLabels', (_e, options: PrintLabelsOptions) =>
    printBarcodeLabels(options)
  )

  ipcMain.handle('customers:list', (_e, search?: string) => customersRepo.listCustomers(search))
  ipcMain.handle('customers:get', (_e, id: number) => customersRepo.getCustomer(id))
  ipcMain.handle('customers:byPhone', (_e, phone: string) => customersRepo.byPhone(phone))
  ipcMain.handle('customers:create', (_e, input) => customersRepo.createCustomer(input))
  ipcMain.handle('customers:update', (_e, id: number, input) => customersRepo.updateCustomer(id, input))
  ipcMain.handle('customers:softDelete', (_e, id: number) => customersRepo.softDeleteCustomer(id))

  ipcMain.handle('sales:list', (_e, filter) => salesRepo.listSales(filter))
  ipcMain.handle('sales:get', (_e, id: number) => salesRepo.getSale(id))
  ipcMain.handle('sales:create', (_e, input) => salesRepo.createSale(input))
  ipcMain.handle('sales:void', (_e, id: number) => salesRepo.voidSale(id))
  ipcMain.handle('sales:lastVoidable', () => salesRepo.lastVoidable())
  ipcMain.handle('sales:report', (_e, from: string, to: string) => salesRepo.buildReport(from, to))

  ipcMain.handle('dashboard:stats', () => dashboardRepo.dashboardStats())

  ipcMain.handle('files:backup', (e) => backupDatabase(parentOf(e)))
  ipcMain.handle('files:restore', (e) => restoreDatabase(parentOf(e)))

  ipcMain.handle('pdf:saveInvoice', async (e, saleId: number) => {
    const buffer = await buildInvoiceBuffer(saleId)
    const sale = salesRepo.getSale(saleId)
    const name = sale ? `${sale.invoice_number}.pdf` : 'invoice.pdf'
    const { canceled, filePath } = await dialog.showSaveDialog(parentOf(e), {
      title: 'Save invoice as PDF',
      defaultPath: name,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    await fs.writeFile(filePath, buffer)
    logActivity('invoice.save', `Saved ${name}`)
    return filePath
  })
  ipcMain.handle('pdf:printInvoice', async (_e, saleId: number) => {
    await printThermalReceipt({ saleId })
  })
  ipcMain.handle('pdf:getInvoiceBuffer', async (_e, saleId: number) => {
    const buffer = await buildInvoiceBuffer(saleId)
    return new Uint8Array(buffer)
  })

  ipcMain.handle('pdf:saveReport', async (e, from: string, to: string) => {
    const buffer = await buildReportBuffer(from, to)
    const { canceled, filePath } = await dialog.showSaveDialog(parentOf(e), {
      title: 'Save sales report as PDF',
      defaultPath: `sales-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    await fs.writeFile(filePath, buffer)
    return filePath
  })
  ipcMain.handle('pdf:printReport', async (_e, from: string, to: string) => {
    const buffer = await buildReportBuffer(from, to)
    await printPdfBuffer(buffer)
  })

  ipcMain.handle('db:clearAll', () => maintenance.clearAllData())
  ipcMain.handle('db:loadDemo', () => maintenance.loadDemoData())
}
