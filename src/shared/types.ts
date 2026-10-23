// Shared domain types used by main, preload, and renderer.

export interface Category {
  id: number
  name: string
  created_at: string
}

export interface Product {
  id: number
  name: string
  sku: string
  price_cents: number
  cost_cents: number
  stock: number
  low_stock_threshold: number
  category_id: number | null
  category_name: string | null
  image: string | null
  description: string | null
  created_at: string
  updated_at: string
  is_deleted: number
}

export interface ProductInput {
  name: string
  sku: string
  price_cents: number
  cost_cents?: number
  stock?: number
  low_stock_threshold?: number
  category_id?: number | null
  image?: string | null
  description?: string | null
}

export interface Customer {
  id: number
  name: string
  phone: string
  place: string | null
  created_at: string
  updated_at: string
  is_deleted: number
  total_spent_cents: number
  order_count: number
  last_purchase: string | null
}

export interface CustomerInput {
  name: string
  phone: string
  place?: string | null
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number | null
  product_name: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
  category_id: number | null
}

export interface Sale {
  id: number
  invoice_number: string
  customer_id: number | null
  customer_name: string | null
  customer_phone: string | null
  customer_place: string | null
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  payment_method: string
  notes: string | null
  created_at: string
  is_voided: number
  items: SaleItem[]
}

export interface SaleItemInput {
  product_id: number | null
  product_name: string
  unit_price_cents: number
  quantity: number
  category_id: number | null
}

export interface SaleCreateInput {
  customer_id: number | null
  payment_method: string
  notes: string | null
  items: SaleItemInput[]
}

export interface ActivityEntry {
  id: number
  action: string
  details: string | null
  created_at: string
}

export interface AppSettings {
  business_name: string
  owner_name: string
  phone: string
  email: string
  address: string
  logo: string | null
  currency: string
  tax_rate: number
  receipt_footer: string
  theme: 'dark' | 'light'
  camera_device_id: string | null
  scanner_sensitivity: number
  invoice_prefix: string
  low_stock_default: number
}

export interface ListProductsFilter {
  search?: string
  category_id?: number | null
  low_stock_only?: boolean
  sort?: 'name' | 'price' | 'stock' | 'updated_at'
  dir?: 'asc' | 'desc'
}

export interface ListSalesFilter {
  search?: string
  from?: string | null
  to?: string | null
}

export interface DashboardStats {
  total_revenue_cents: number
  today_revenue_cents: number
  sales_count: number
  today_sales_count: number
  product_count: number
  low_stock_count: number
  customer_count: number
  revenue_series: { label: string; cents: number }[]
  top_products: { name: string; qty: number; cents: number }[]
  category_sales: { name: string; cents: number }[]
  activity: ActivityEntry[]
}

export interface ReportData {
  from: string
  to: string
  total_orders: number
  total_revenue_cents: number
  average_order_cents: number
  items: { product: string; qty: number; unit_cents: number; line_total_cents: number }[]
}

export interface ImportResult {
  created: number
  updated: number
  errors: string[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  business_name: 'My Business',
  owner_name: '',
  phone: '',
  email: '',
  address: '',
  logo: null,
  currency: 'INR',
  tax_rate: 0,
  receipt_footer: 'Thank you for your business!',
  theme: 'dark',
  camera_device_id: null,
  scanner_sensitivity: 1200,
  invoice_prefix: 'INV',
  low_stock_default: 5
}

// Full typed API surface exposed on window.api via contextBridge.
export interface UpdateInfo {
  version: string
  releaseNotes: string | null
  releaseDate: string
  files: { url: string; size: number }[]
}

export interface UpdaterStatus {
  checking: boolean
  updateAvailable: boolean
  updateDownloaded: boolean
  updateInfo: UpdateInfo | null
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateCheckResult {
  success: boolean
  message?: string
  updateInfo?: UpdateInfo
}

export interface ClerkkApi {
  app: {
    version: () => Promise<string>
    reveal: (path: string) => Promise<void>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (partial: Partial<AppSettings>) => Promise<AppSettings>
  }
  categories: {
    list: () => Promise<Category[]>
    create: (name: string) => Promise<Category>
    delete: (id: number) => Promise<void>
  }
  products: {
    list: (filter?: ListProductsFilter) => Promise<Product[]>
    get: (id: number) => Promise<Product | null>
    bySku: (sku: string) => Promise<Product | null>
    create: (input: ProductInput) => Promise<Product>
    update: (id: number, input: ProductInput) => Promise<Product>
    softDelete: (id: number) => Promise<void>
    adjustStock: (id: number, delta: number) => Promise<Product>
    generateSku: () => Promise<string>
    importCsv: (rows: string[][]) => Promise<ImportResult>
    exportCsv: () => Promise<string>
  }
  customers: {
    list: (search?: string) => Promise<Customer[]>
    get: (id: number) => Promise<Customer | null>
    byPhone: (phone: string) => Promise<Customer | null>
    create: (input: CustomerInput) => Promise<Customer>
    update: (id: number, input: CustomerInput) => Promise<Customer>
    softDelete: (id: number) => Promise<void>
  }
  sales: {
    list: (filter?: ListSalesFilter) => Promise<Sale[]>
    get: (id: number) => Promise<Sale | null>
    create: (input: SaleCreateInput) => Promise<Sale>
    void: (id: number) => Promise<void>
    lastVoidable: () => Promise<Sale | null>
    report: (from: string, to: string) => Promise<ReportData>
  }
  dashboard: {
    stats: () => Promise<DashboardStats>
  }
  files: {
    backup: () => Promise<string | null>
    restore: () => Promise<boolean>
  }
  pdf: {
    saveInvoice: (saleId: number) => Promise<string | null>
    printInvoice: (saleId: number) => Promise<void>
    getInvoiceBuffer: (saleId: number) => Promise<Uint8Array>
    saveReport: (from: string, to: string) => Promise<string | null>
    printReport: (from: string, to: string) => Promise<void>
  }
  db: {
    clearAll: () => Promise<void>
    loadDemo: () => Promise<void>
  }
  updater: {
    checkForUpdates: () => Promise<UpdateCheckResult>
    downloadUpdate: () => Promise<UpdateCheckResult>
    installUpdate: () => Promise<UpdateCheckResult>
    getStatus: () => Promise<UpdaterStatus>
    openReleaseNotes: () => Promise<void>
    onStatus: (callback: (status: { status: string; data?: unknown }) => void) => () => void
    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
  }
}
