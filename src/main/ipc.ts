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

function parentOf(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  return BrowserWindow.fromWebContents(event.sender) as BrowserWindow
}

async function printPdfBuffer(buffer: Buffer): Promise<void> {
  const tmp = join(app.getPath('temp'), `clerkk-print-${Date.now()}.pdf`)
  await fs.writeFile(tmp, buffer)
  await new Promise<void>((resolve) => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    win.webContents.once('did-finish-load', () => {
      win.webContents.print({ silent: false, printBackground: true }, () => {
        win.destroy()
        fs.unlink(tmp).catch(() => {})
        resolve()
      })
    })
    win.loadURL(pathToFileURL(tmp).toString())
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
  ipcMain.handle('products:importCsv', (_e, rows: string[][]) => productsRepo.importCsv(rows))
  ipcMain.handle('products:exportCsv', () => productsRepo.exportCsv())

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
    const buffer = await buildInvoiceBuffer(saleId)
    await printPdfBuffer(buffer)
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
