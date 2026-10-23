import { contextBridge, ipcRenderer } from 'electron'
import type { ClerkkApi } from '../shared/types'

const api: ClerkkApi = {
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    reveal: (path) => ipcRenderer.invoke('app:reveal', path)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (partial) => ipcRenderer.invoke('settings:update', partial)
  },
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (name) => ipcRenderer.invoke('categories:create', name),
    delete: (id) => ipcRenderer.invoke('categories:delete', id)
  },
  products: {
    list: (filter) => ipcRenderer.invoke('products:list', filter),
    get: (id) => ipcRenderer.invoke('products:get', id),
    bySku: (sku) => ipcRenderer.invoke('products:bySku', sku),
    create: (input) => ipcRenderer.invoke('products:create', input),
    update: (id, input) => ipcRenderer.invoke('products:update', id, input),
    softDelete: (id) => ipcRenderer.invoke('products:softDelete', id),
    adjustStock: (id, delta) => ipcRenderer.invoke('products:adjustStock', id, delta),
    generateSku: () => ipcRenderer.invoke('products:generateSku'),
    importCsv: (rows) => ipcRenderer.invoke('products:importCsv', rows),
    exportCsv: () => ipcRenderer.invoke('products:exportCsv'),
    generateBarcodeImage: (productName: string, priceCents?: number) => ipcRenderer.invoke('products:generateBarcodeImage', productName, priceCents),
    generateBarcodesPdf: () => ipcRenderer.invoke('products:generateBarcodesPdf')
  },
  customers: {
    list: (search) => ipcRenderer.invoke('customers:list', search),
    get: (id) => ipcRenderer.invoke('customers:get', id),
    byPhone: (phone) => ipcRenderer.invoke('customers:byPhone', phone),
    create: (input) => ipcRenderer.invoke('customers:create', input),
    update: (id, input) => ipcRenderer.invoke('customers:update', id, input),
    softDelete: (id) => ipcRenderer.invoke('customers:softDelete', id)
  },
  sales: {
    list: (filter) => ipcRenderer.invoke('sales:list', filter),
    get: (id) => ipcRenderer.invoke('sales:get', id),
    create: (input) => ipcRenderer.invoke('sales:create', input),
    void: (id) => ipcRenderer.invoke('sales:void', id),
    lastVoidable: () => ipcRenderer.invoke('sales:lastVoidable'),
    report: (from, to) => ipcRenderer.invoke('sales:report', from, to)
  },
  dashboard: {
    stats: () => ipcRenderer.invoke('dashboard:stats')
  },
  files: {
    backup: () => ipcRenderer.invoke('files:backup'),
    restore: () => ipcRenderer.invoke('files:restore')
  },
  pdf: {
    saveInvoice: (saleId) => ipcRenderer.invoke('pdf:saveInvoice', saleId),
    printInvoice: (saleId) => ipcRenderer.invoke('pdf:printInvoice', saleId),
    getInvoiceBuffer: (saleId) => ipcRenderer.invoke('pdf:getInvoiceBuffer', saleId),
    saveReport: (from, to) => ipcRenderer.invoke('pdf:saveReport', from, to),
    printReport: (from, to) => ipcRenderer.invoke('pdf:printReport', from, to)
  },
  db: {
    clearAll: () => ipcRenderer.invoke('db:clearAll'),
    loadDemo: () => ipcRenderer.invoke('db:loadDemo')
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
    installUpdate: () => ipcRenderer.invoke('updater:install-update'),
    getStatus: () => ipcRenderer.invoke('updater:get-status'),
    openReleaseNotes: () => ipcRenderer.invoke('updater:open-release-notes'),
    onStatus: (callback: (status: { status: string; data?: unknown }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: { status: string; data?: unknown }) => callback(data)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.off('updater:status', handler)
    },
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => callback(data)
      ipcRenderer.on('updater:download-progress', handler)
      return () => ipcRenderer.off('updater:download-progress', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
