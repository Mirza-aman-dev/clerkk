import { BrowserWindow, WebContents, app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import bwipjs from 'bwip-js'
import {
  AppSettings,
  LabelPaperSize,
  PrinterDeviceInfo,
  PrintLabelsOptions,
  PrintReceiptOptions,
  ReceiptPaperWidth,
  Sale,
  UsbScannerDeviceInfo
} from '../shared/types'
import { getSale } from './db/sales'
import { getSettings } from './db/settings'
import { listProducts, getProduct } from './db/products'
import { logActivity } from './db'
import { formatDate, formatCurrency, ean13CheckDigit } from '../shared/util'

const execAsync = promisify(exec)

const POSIFLOW_KEYWORDS = [
  'posiflow',
  'psf20',
  'psf-20',
  'psf 20',
  'psf',
  'shreyans',
  'tagsmart',
  'taglite',
  'bluetooth',
  'bth',
  'mpt'
]

const THERMAL_KEYWORDS = [
  ...POSIFLOW_KEYWORDS,
  '26mm',
  'label',
  'pos',
  'thermal',
  'receipt',
  'bill',
  '58mm',
  '80mm',
  '58',
  '80',
  'xp-',
  'xprinter',
  'epson',
  'tm-',
  'rp-',
  'rp58',
  'rp80',
  'rongta',
  'tvs',
  'star',
  'tsp',
  'bixolon',
  'citizen',
  'rugtek',
  'everycom',
  'munbyn',
  'gprinter',
  'gp-',
  'sewoo',
  'hprt',
  'deli',
  'zebra',
  'znyj',
  'zj-',
  'zjiang'
]

const VIRTUAL_PRINTER_KEYWORDS = [
  'microsoft print to pdf',
  'microsoft xps',
  'onenote',
  'fax',
  'adobe pdf',
  'foxit'
]

function decodePrinterStatus(status: number, options: Record<string, string> = {}): {
  statusText: string
  isConnected: boolean
} {
  const stateStr = (options['printer-state'] || options['Status'] || '').toLowerCase()
  const reasons = (options['printer-state-reasons'] || '').toLowerCase()

  if (
    reasons.includes('offline') ||
    stateStr.includes('offline') ||
    status === 8 ||
    status === 128 ||
    status === 4096
  ) {
    return { statusText: 'Offline', isConnected: false }
  }
  if (reasons.includes('media-empty') || status === 5 || status === 16) {
    return { statusText: 'Paper Out', isConnected: true }
  }
  if (reasons.includes('media-jam') || status === 4 || status === 8) {
    return { statusText: 'Paper Jam', isConnected: true }
  }
  if (status === 1 || stateStr === '4' || stateStr.includes('printing') || status === 1024) {
    return { statusText: 'Printing', isConnected: true }
  }
  if (status === 2 || stateStr === '5' || stateStr.includes('paused')) {
    return { statusText: 'Paused', isConnected: true }
  }
  if (
    status === 0 ||
    stateStr === '3' ||
    stateStr === 'idle' ||
    stateStr === 'normal' ||
    !stateStr
  ) {
    return { statusText: 'Ready', isConnected: true }
  }
  return { statusText: 'Ready', isConnected: true }
}

function isPosiflowPrinter(
  name: string,
  displayName: string,
  description: string,
  model: string
): boolean {
  const combined = `${name} ${displayName} ${description} ${model}`.toLowerCase()
  return POSIFLOW_KEYWORDS.some((k) => combined.includes(k))
}

function isLikelyThermalPrinter(
  name: string,
  displayName: string,
  description: string,
  model: string
): boolean {
  const combined = `${name} ${displayName} ${description} ${model}`.toLowerCase()
  if (VIRTUAL_PRINTER_KEYWORDS.some((k) => combined.includes(k))) return false
  return THERMAL_KEYWORDS.some((k) => combined.includes(k))
}

export async function listPrinters(wc?: WebContents): Promise<PrinterDeviceInfo[]> {
  try {
    const targetWc = wc ?? BrowserWindow.getAllWindows()[0]?.webContents
    if (!targetWc) return []

    const rawPrinters = await targetWc.getPrintersAsync()
    const winPorts = new Map<string, { port: string; driver: string; workOffline: boolean }>()

    if (process.platform === 'win32') {
      try {
        const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Printer | Select-Object Name, PortName, DriverName, WorkOffline | ConvertTo-Json -Compress"`
        const { stdout } = await execAsync(psCmd, { timeout: 2500 })
        if (stdout && stdout.trim()) {
          const parsed = JSON.parse(stdout.trim())
          const arr = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of arr) {
            if (item && item.Name) {
              winPorts.set(String(item.Name).toLowerCase(), {
                port: String(item.PortName || 'USB / Local Port'),
                driver: String(item.DriverName || ''),
                workOffline: Boolean(item.WorkOffline)
              })
            }
          }
        }
      } catch {
        // Fallback to Electron's printer options if PowerShell is slow or restricted
      }
    }

    const mapped: PrinterDeviceInfo[] = rawPrinters.map((p) => {
      const opts = (p.options || {}) as Record<string, string>
      const winExtra = winPorts.get(p.name.toLowerCase())
      const driverModel =
        winExtra?.driver ||
        opts['printer-make-and-model'] ||
        p.description ||
        p.displayName ||
        p.name
      const portOrUri =
        winExtra?.port ||
        opts['device-uri'] ||
        opts['printer-location'] ||
        (p.name.toLowerCase().includes('usb') ? 'USB Port' : 'System Spooler / USB')

      const decoded = decodePrinterStatus(p.status, opts)
      const isOffline = winExtra?.workOffline === true || !decoded.isConnected
      const statusText = isOffline ? 'Offline' : decoded.statusText

      const isThermal = isLikelyThermalPrinter(
        p.name,
        p.displayName || '',
        p.description || '',
        driverModel
      )

      return {
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || driverModel,
        status: p.status,
        statusText,
        isDefault: Boolean(p.isDefault),
        isThermal,
        portOrUri,
        driverModel,
        isConnected: !isOffline
      }
    })

    // Sort: POSiFLOW PSF20 first, then thermal printers, then default printer, then connected
    mapped.sort((a, b) => {
      const aPosi = isPosiflowPrinter(a.name, a.displayName, a.description, a.driverModel)
      const bPosi = isPosiflowPrinter(b.name, b.displayName, b.description, b.driverModel)
      if (aPosi !== bPosi) return aPosi ? -1 : 1
      if (a.isThermal !== b.isThermal) return a.isThermal ? -1 : 1
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1
      return a.displayName.localeCompare(b.displayName)
    })

    return mapped
  } catch (err) {
    console.error('Failed to list printers:', err)
    return []
  }
}

const SCANNER_BRAND_KEYWORDS = [
  'barcode',
  'scanner',
  'symbol',
  'zebra',
  'honeywell',
  'datalogic',
  'newland',
  'netum',
  'tera',
  'inateck',
  'nadamoo',
  'socket',
  'voyager',
  'xenon',
  'orbit',
  'ls2208',
  'ds2208',
  'li4278',
  'pos',
  '1d',
  '2d',
  'qr',
  'opticon',
  'champ',
  'eyoyo',
  'symcode',
  'tvs',
  'rugtek',
  'iball',
  'retrack',
  'winson',
  'deli',
  'henex'
]

const EXCLUDE_USB_KEYWORDS = [
  'mouse',
  'trackpad',
  'touchpad',
  'audio',
  'headset',
  'microphone',
  'speaker',
  'webcam',
  'camera',
  'bluetooth',
  'root hub',
  'host controller',
  'mass storage',
  'flash',
  'disk',
  'wireless receiver',
  'gaming',
  'internal',
  'apple internal',
  'fingerprint',
  'biometric',
  'sensor'
]

export async function listUsbScanners(): Promise<UsbScannerDeviceInfo[]> {
  const devices: UsbScannerDeviceInfo[] = []
  try {
    if (process.platform === 'win32') {
      const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Present -eq $true -and ($_.PNPClass -eq 'Keyboard' -or $_.PNPClass -eq 'HIDClass' -or $_.DeviceID -like 'USB*') } | Select-Object Name, Description, Manufacturer, DeviceID, PNPClass | ConvertTo-Json -Compress"`
      const { stdout } = await execAsync(psCmd, { timeout: 3000 })
      if (stdout && stdout.trim()) {
        const parsed = JSON.parse(stdout.trim())
        const items = Array.isArray(parsed) ? parsed : [parsed]
        const seenVidPid = new Set<string>()

        for (const item of items) {
          const name = String(item?.Name || item?.Description || '').trim()
          const mfg = String(item?.Manufacturer || 'USB HID').trim()
          const devId = String(item?.DeviceID || '').trim()
          const pnpClass = String(item?.PNPClass || '').trim()
          const lower = `${name} ${mfg} ${devId}`.toLowerCase()

          if (!name || EXCLUDE_USB_KEYWORDS.some((k) => lower.includes(k))) continue

          const vidMatch = devId.match(/VID_([0-9A-F]{4})/i)
          const pidMatch = devId.match(/PID_([0-9A-F]{4})/i)
          const vid = vidMatch ? vidMatch[1].toUpperCase() : undefined
          const pid = pidMatch ? pidMatch[1].toUpperCase() : undefined
          const key = vid && pid ? `${vid}:${pid}` : devId

          const isExplicitScanner = SCANNER_BRAND_KEYWORDS.some((k) => lower.includes(k))
          const isExternalUsbKeyboardOrInput =
            (pnpClass === 'Keyboard' && devId.startsWith('HID\\VID_')) ||
            (name.toLowerCase().includes('usb input device') && Boolean(vid))

          if (isExplicitScanner || isExternalUsbKeyboardOrInput) {
            if (seenVidPid.has(key)) continue
            seenVidPid.add(key)
            devices.push({
              id: key,
              name: isExplicitScanner
                ? name
                : `USB Barcode / HID Device (${vid && pid ? `${vid}:${pid}` : name})`,
              manufacturer: mfg.replace(/^\(Standard .*?\)$/i, 'USB HID Wedge'),
              vendorId: vid,
              productId: pid,
              connectionType: isExplicitScanner ? 'usb-pos' : 'usb-hid',
              status: 'connected'
            })
          }
        }
      }
    } else if (process.platform === 'darwin') {
      const { stdout } = await execAsync('ioreg -r -c IOHIDDevice -w0', { timeout: 2500 })
      const blocks = stdout.split('+-o ').slice(1)
      const seen = new Set<string>()

      for (const block of blocks) {
        const isUsb = /"Transport"\s*=\s*"USB"/i.test(block)
        const isBuiltIn = /"Built-In"\s*=\s*Yes/i.test(block)
        if (!isUsb || isBuiltIn) continue

        const prodMatch = block.match(/"Product"\s*=\s*"([^"]+)"/)
        const mfgMatch = block.match(/"Manufacturer"\s*=\s*"([^"]+)"/)
        const vidMatch = block.match(/"VendorID"\s*=\s*(\d+)/)
        const pidMatch = block.match(/"ProductID"\s*=\s*(\d+)/)
        const usagePageMatch = block.match(/"PrimaryUsagePage"\s*=\s*(\d+)/)
        const usageMatch = block.match(/"PrimaryUsage"\s*=\s*(\d+)/)

        const name = prodMatch ? prodMatch[1].trim() : 'USB HID Scanner'
        const mfg = mfgMatch ? mfgMatch[1].trim() : 'USB HID'
        const lower = `${name} ${mfg}`.toLowerCase()

        if (EXCLUDE_USB_KEYWORDS.some((k) => lower.includes(k))) continue

        const usagePage = usagePageMatch ? Number(usagePageMatch[1]) : 0
        const usage = usageMatch ? Number(usageMatch[1]) : 0
        const isScannerOrKeyboard =
          usagePage === 140 ||
          (usagePage === 1 && usage === 6) ||
          SCANNER_BRAND_KEYWORDS.some((k) => lower.includes(k))

        if (!isScannerOrKeyboard) continue

        const vid = vidMatch
          ? Number(vidMatch[1]).toString(16).toUpperCase().padStart(4, '0')
          : undefined
        const pid = pidMatch
          ? Number(pidMatch[1]).toString(16).toUpperCase().padStart(4, '0')
          : undefined
        const id = vid && pid ? `${vid}:${pid}` : name
        if (seen.has(id)) continue
        seen.add(id)

        devices.push({
          id,
          name,
          manufacturer: mfg,
          vendorId: vid,
          productId: pid,
          connectionType: usagePage === 140 ? 'usb-pos' : 'usb-hid',
          status: 'connected'
        })
      }
    } else if (process.platform === 'linux') {
      const { stdout } = await execAsync('lsusb', { timeout: 2000 })
      const lines = stdout.split('\n')
      for (const line of lines) {
        const lower = line.toLowerCase()
        if (SCANNER_BRAND_KEYWORDS.some((k) => lower.includes(k))) {
          const idMatch = line.match(/ID\s+([0-9a-f]{4}):([0-9a-f]{4})\s+(.+)$/i)
          if (idMatch) {
            devices.push({
              id: `${idMatch[1].toUpperCase()}:${idMatch[2].toUpperCase()}`,
              name: idMatch[3].trim(),
              manufacturer: 'USB HID',
              vendorId: idMatch[1].toUpperCase(),
              productId: idMatch[2].toUpperCase(),
              connectionType: 'usb-hid',
              status: 'connected'
            })
          }
        }
      }
    }
  } catch {
    // Ignore enumeration errors on restricted systems
  }

  return devices
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Builds receipt HTML optimized for POSiFLOW PSF20 (26mm label / 26mm narrow roll)
 * as well as standard 58mm, 80mm, and A5 formats.
 */
export function buildThermalReceiptHtml(
  sale: Sale,
  settings: AppSettings,
  paperWidth: ReceiptPaperWidth = '26mm'
): string {
  const currency = settings.currency || 'INR'
  const money = (cents: number) => formatCurrency(cents, currency)

  const isPosiflowLabel =
    paperWidth !== '58mm' && paperWidth !== '80mm' && paperWidth !== 'A5'

  // Dedicated POSiFLOW PSF20 Label Layout (supports all 7 official label sizes + auto-detect)
  if (isPosiflowLabel) {
    const geom = resolveLabelGeometry(
      paperWidth as LabelPaperSize | '25mm' | '26mm' | '26mm-narrow'
    )
    const pageSizeCss = `${geom.pageWidthMm}mm ${geom.pageHeightMm}mm`
    const containerWidth = `${geom.coreWidthMm}mm`
    const baseFont = geom.pageHeightMm <= 15 ? '6.5px' : '7.5px'
    const titleFont = geom.pageHeightMm <= 15 ? '7.5px' : '9px'

    const compactItemsHtml = sale.items
      .map(
        (item) => `
        <div class="lbl-item">
          <span class="lbl-item-name">${escapeHtml(item.product_name)} <span class="lbl-qty">×${item.quantity}</span></span>
          <span class="lbl-item-amt">${escapeHtml(money(item.line_total_cents))}</span>
        </div>`
      )
      .join('')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Label Bill ${escapeHtml(sale.invoice_number)}</title>
  <style>
    @page {
      size: ${pageSizeCss};
      margin: 0mm !important;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      background: #ffffff;
      color: #000000;
      font-family: 'Arial', 'Helvetica Neue', 'Consolas', sans-serif;
      font-size: ${baseFont};
      line-height: 1.15;
      font-weight: 600;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label-sheet {
      width: ${containerWidth};
      max-width: 86%;
      margin: 0 auto;
      padding: 2mm 1.5mm;
      overflow: hidden;
    }
    .hdr {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid #000;
      padding-bottom: 0.6mm;
      margin-bottom: 0.6mm;
    }
    .biz {
      font-size: ${titleFont};
      font-weight: 900;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 62%;
    }
    .inv {
      font-size: ${baseFont};
      font-family: 'Consolas', monospace;
      font-weight: 800;
    }
    .sub-meta {
      display: flex;
      justify-content: space-between;
      font-size: 6.5px;
      margin-bottom: 0.5mm;
      border-bottom: 0.5px dashed #000;
      padding-bottom: 0.4mm;
    }
    .items-wrap {
      margin: 0.5mm 0;
    }
    .lbl-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 2px;
      margin: 0.3mm 0;
    }
    .lbl-item-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 72%;
      font-weight: 700;
    }
    .lbl-qty {
      font-weight: 900;
    }
    .lbl-item-amt {
      font-family: 'Consolas', monospace;
      font-weight: 800;
      white-space: nowrap;
    }
    .tot-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #000;
      margin-top: 0.6mm;
      padding-top: 0.6mm;
      font-size: ${titleFont};
      font-weight: 900;
    }
    .tot-meta {
      font-size: 6.5px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="label-sheet">
    <div class="hdr">
      <span class="biz">${escapeHtml(settings.business_name || 'Clerkk')}</span>
      <span class="inv">#${escapeHtml(sale.invoice_number)}</span>
    </div>
    <div class="sub-meta">
      <span>${escapeHtml(sale.customer_name || 'Walk-in')} (${escapeHtml((sale.payment_method || 'CASH').toUpperCase())})</span>
      <span>${escapeHtml(new Date(sale.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }))}</span>
    </div>
    <div class="items-wrap">
      ${compactItemsHtml}
    </div>
    <div class="tot-bar">
      <span class="tot-meta">QTY: ${sale.items.reduce((a, b) => a + b.quantity, 0)}${sale.tax_cents > 0 ? ` · TAX ${settings.tax_rate}%` : ''}</span>
      <span>TOTAL: ${escapeHtml(money(sale.total_cents))}</span>
    </div>
  </div>
</body>
</html>`
  }

  const is58 = paperWidth === '58mm'
  const isA5 = paperWidth === 'A5'

  const containerWidth = is58 ? '48mm' : isA5 ? '138mm' : '72mm'
  const pageSizeCss = is58 ? '58mm auto' : isA5 ? 'A5 portrait' : '80mm auto'
  const baseFontSize = is58 ? '11px' : isA5 ? '13px' : '12px'
  const titleFontSize = is58 ? '15px' : isA5 ? '20px' : '17px'

  const itemsHtml = sale.items
    .map(
      (item, idx) => `
      <tr>
        <td class="item-name" colspan="4">${idx + 1}. ${escapeHtml(item.product_name)}</td>
      </tr>
      <tr class="item-nums">
        <td></td>
        <td class="qty">${item.quantity} x ${escapeHtml(money(item.unit_price_cents))}</td>
        <td class="amt" colspan="2">${escapeHtml(money(item.line_total_cents))}</td>
      </tr>
    `
    )
    .join('')

  const logoHtml = settings.logo
    ? `<div class="logo-wrap"><img src="${settings.logo}" alt="Logo" class="logo" /></div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(sale.invoice_number)}</title>
  <style>
    @page {
      size: ${pageSizeCss};
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      background: #ffffff;
      color: #000000;
      font-family: 'Consolas', 'Courier New', 'Liberation Mono', monospace;
      font-size: ${baseFontSize};
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: ${containerWidth};
      max-width: 100%;
      margin: 0 auto;
      padding: ${is58 ? '2mm 1.5mm 6mm' : isA5 ? '8mm' : '3mm 2mm 8mm'};
    }
    .center {
      text-align: center;
    }
    .logo-wrap {
      text-align: center;
      margin-bottom: 4px;
    }
    .logo {
      max-width: ${is58 ? '36mm' : '48mm'};
      max-height: 18mm;
      object-fit: contain;
    }
    .biz-name {
      font-size: ${titleFontSize};
      font-weight: 800;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .biz-sub {
      font-size: ${is58 ? '10px' : '11px'};
      color: #111111;
      margin-bottom: 1px;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: ${is58 ? '10px' : '11px'};
      margin: 2px 0;
      gap: 4px;
    }
    .meta-label {
      font-weight: 700;
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    table.items th {
      text-align: left;
      font-size: ${is58 ? '10px' : '11px'};
      font-weight: 800;
      border-bottom: 1px dashed #000000;
      padding-bottom: 3px;
      margin-bottom: 3px;
    }
    table.items th.right {
      text-align: right;
    }
    .item-name {
      font-weight: 700;
      padding-top: 4px;
      word-break: break-word;
    }
    .item-nums td {
      font-size: ${is58 ? '10px' : '11px'};
      padding-bottom: 3px;
    }
    .item-nums .qty {
      color: #111111;
    }
    .item-nums .amt {
      text-align: right;
      font-weight: 700;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      font-size: ${baseFontSize};
    }
    .grand-total {
      display: flex;
      justify-content: space-between;
      font-size: ${is58 ? '14px' : '16px'};
      font-weight: 900;
      margin: 5px 0;
      padding: 4px 0;
      border-top: 1.5px solid #000000;
      border-bottom: 1.5px solid #000000;
    }
    .footer {
      margin-top: 8px;
      text-align: center;
      font-size: ${is58 ? '10px' : '11px'};
    }
    .invoice-code {
      margin-top: 4px;
      font-weight: 700;
      letter-spacing: 1.5px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      ${logoHtml}
      <div class="biz-name">${escapeHtml(settings.business_name || 'Clerkk Store')}</div>
      ${settings.address ? `<div class="biz-sub">${escapeHtml(settings.address)}</div>` : ''}
      ${
        settings.phone || settings.email
          ? `<div class="biz-sub">${escapeHtml([settings.phone, settings.email].filter(Boolean).join(' · '))}</div>`
          : ''
      }
    </div>

    <div class="divider"></div>

    <div class="meta-row">
      <span><span class="meta-label">BILL:</span> ${escapeHtml(sale.invoice_number)}</span>
      <span>${escapeHtml((sale.payment_method || 'CASH').toUpperCase())}</span>
    </div>
    <div class="meta-row">
      <span><span class="meta-label">DATE:</span> ${escapeHtml(formatDate(sale.created_at))}</span>
    </div>
    <div class="meta-row">
      <span><span class="meta-label">CUSTOMER:</span> ${escapeHtml(sale.customer_name || 'Walk-in Customer')}</span>
    </div>
    ${
      sale.customer_phone
        ? `<div class="meta-row"><span><span class="meta-label">PHONE:</span> ${escapeHtml(sale.customer_phone)}</span></div>`
        : ''
    }

    <div class="divider"></div>

    <table class="items">
      <thead>
        <tr>
          <th colspan="2">ITEM / QTY</th>
          <th colspan="2" class="right">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="divider"></div>

    <div class="totals-row">
      <span>Items (${sale.items.reduce((acc, i) => acc + i.quantity, 0)} qty)</span>
      <span>${escapeHtml(money(sale.subtotal_cents))}</span>
    </div>
    ${
      sale.tax_cents > 0 || settings.tax_rate > 0
        ? `<div class="totals-row">
            <span>Tax (${settings.tax_rate}%)</span>
            <span>${escapeHtml(money(sale.tax_cents))}</span>
          </div>`
        : ''
    }

    <div class="grand-total">
      <span>TOTAL</span>
      <span>${escapeHtml(money(sale.total_cents))}</span>
    </div>

    ${sale.notes ? `<div class="biz-sub" style="margin-top:4px;">Note: ${escapeHtml(sale.notes)}</div>` : ''}

    <div class="footer">
      <div>${escapeHtml(settings.receipt_footer || 'Thank you for your business!')}</div>
      <div class="invoice-code">*${escapeHtml(sale.invoice_number)}*</div>
    </div>
  </div>
</body>
</html>`
}

function getMicronPageSize(
  paperWidth?: ReceiptPaperWidth
): { width: number; height: number } | undefined {
  // 1 mm = 1000 microns
  const specs: Record<string, { width: number; height: number }> = {
    '38x15mm': { width: 38000, height: 15000 },
    '50x12mm': { width: 50000, height: 12000 },
    '38x25mm': { width: 38000, height: 25000 },
    '50x25mm': { width: 50000, height: 25000 },
    '38x38mm': { width: 38000, height: 38000 },
    '50x30mm': { width: 50000, height: 30000 },
    '50x50mm': { width: 50000, height: 50000 },
    '25mm': { width: 38000, height: 25000 },
    '26mm': { width: 50000, height: 25000 },
    '26mm-narrow': { width: 38000, height: 25000 }
  }
  return paperWidth ? specs[paperWidth] : undefined
}

async function printHtmlInHiddenWindow(
  html: string,
  deviceName?: string | null,
  silent = true,
  copies = 1,
  paperWidth?: ReceiptPaperWidth
): Promise<{ success: boolean; printerName: string }> {
  const tmpHtml = join(
    app.getPath('temp'),
    `clerkk-bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.html`
  )
  await fs.writeFile(tmpHtml, html, 'utf-8')

  const targetDevice = deviceName?.trim() || ''
  const isVirtual = VIRTUAL_PRINTER_KEYWORDS.some((k) => targetDevice.toLowerCase().includes(k))
  const useSilent = Boolean(targetDevice) && silent && !isVirtual
  const customPageSize = getMicronPageSize(paperWidth)

  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 380,
      height: 640,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true
      }
    })

    let settled = false
    const cleanup = () => {
      if (!win.isDestroyed()) win.destroy()
      fs.unlink(tmpHtml).catch(() => {})
    }

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        cleanup()
        reject(
          new Error(
            'Printer timed out. Please verify the POSiFLOW PSF20 / bill printer is powered on and connected.'
          )
        )
      }
    }, 30000)

    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (settled || win.isDestroyed()) return
        const primaryOpts: Electron.WebContentsPrintOptions = {
          silent: useSilent,
          printBackground: true,
          deviceName: targetDevice || undefined,
          copies: Math.max(1, copies),
          margins: { marginType: 'none' },
          ...(customPageSize ? { pageSize: customPageSize } : {})
        }

        win.webContents.print(primaryOpts, (success, failureReason) => {
          if (settled) return
          if (!success && useSilent) {
            // Step 2: If driver rejected explicit micron pageSize, retry silent print using @page CSS dimensions
            if (customPageSize) {
              win.webContents.print(
                {
                  silent: true,
                  printBackground: true,
                  deviceName: targetDevice || undefined,
                  copies: Math.max(1, copies),
                  margins: { marginType: 'none' }
                },
                (retrySuccess) => {
                  if (settled) return
                  if (retrySuccess) {
                    settled = true
                    clearTimeout(timeout)
                    cleanup()
                    resolve({
                      success: true,
                      printerName: targetDevice || 'POSiFLOW PSF20'
                    })
                    return
                  }
                  // Step 3: Fallback to system dialog
                  win.webContents.print(
                    {
                      silent: false,
                      printBackground: true,
                      deviceName: targetDevice || undefined,
                      copies: Math.max(1, copies)
                    },
                    (fallbackSuccess, fallbackReason) => {
                      if (settled) return
                      settled = true
                      clearTimeout(timeout)
                      cleanup()
                      if (
                        !fallbackSuccess &&
                        fallbackReason &&
                        fallbackReason !== 'cancelled'
                      ) {
                        reject(new Error(fallbackReason))
                      } else {
                        resolve({
                          success: fallbackSuccess,
                          printerName: targetDevice || 'System Printer'
                        })
                      }
                    }
                  )
                }
              )
              return
            }

            // Fallback to native dialog
            win.webContents.print(
              {
                silent: false,
                printBackground: true,
                deviceName: targetDevice || undefined,
                copies: Math.max(1, copies)
              },
              (fallbackSuccess, fallbackReason) => {
                if (settled) return
                settled = true
                clearTimeout(timeout)
                cleanup()
                if (!fallbackSuccess && fallbackReason && fallbackReason !== 'cancelled') {
                  reject(new Error(fallbackReason))
                } else {
                  resolve({
                    success: fallbackSuccess,
                    printerName: targetDevice || 'System Printer'
                  })
                }
              }
            )
            return
          }

          settled = true
          clearTimeout(timeout)
          cleanup()
          if (!success && failureReason && failureReason !== 'cancelled') {
            reject(new Error(failureReason))
          } else {
            resolve({
              success,
              printerName: targetDevice || 'System Printer'
            })
          }
        })
      }, 150)
    })

    win.loadURL(pathToFileURL(tmpHtml).toString()).catch((err) => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        cleanup()
        reject(err)
      }
    })
  })
}

export async function printThermalReceipt(
  options: PrintReceiptOptions
): Promise<{ success: boolean; printerName: string }> {
  const sale = getSale(options.saleId)
  if (!sale) throw new Error('Sale not found')
  const settings = getSettings()
  const paperWidth = options.paperWidth || settings.receipt_paper_width || '26mm'
  const deviceName =
    options.deviceName !== undefined ? options.deviceName : settings.printer_device_name

  const html = buildThermalReceiptHtml(sale, settings, paperWidth)
  const res = await printHtmlInHiddenWindow(
    html,
    deviceName,
    options.silent ?? true,
    options.copies ?? 1,
    paperWidth
  )
  if (res.success) {
    logActivity(
      'invoice.print',
      `Printed ${sale.invoice_number} on ${res.printerName} (${paperWidth})`
    )
  }
  return res
}

export async function getReceiptHtml(
  saleId: number,
  paperWidth?: ReceiptPaperWidth
): Promise<string> {
  const sale = getSale(saleId)
  if (!sale) throw new Error('Sale not found')
  const settings = getSettings()
  return buildThermalReceiptHtml(
    sale,
    settings,
    paperWidth || settings.receipt_paper_width || '26mm'
  )
}

export async function testPrint(
  deviceName?: string | null,
  paperWidth?: ReceiptPaperWidth
): Promise<{ success: boolean; printerName: string }> {
  const settings = getSettings()
  const width = paperWidth || settings.receipt_paper_width || '26mm'
  const target = deviceName !== undefined ? deviceName : settings.printer_device_name

  const sampleSale: Sale = {
    id: 0,
    invoice_number: `${settings.invoice_prefix || 'INV'}-TEST`,
    customer_id: null,
    customer_name: 'POSiFLOW PSF20 Test',
    customer_phone: null,
    customer_place: null,
    subtotal_cents: 249900,
    tax_cents: Math.round((249900 * (settings.tax_rate || 0)) / 100),
    total_cents: 249900 + Math.round((249900 * (settings.tax_rate || 0)) / 100),
    payment_method: 'cash',
    notes: 'POSiFLOW PSF20 26mm Label Calibration Test',
    created_at: new Date().toISOString(),
    is_voided: 0,
    items: [
      {
        id: 1,
        sale_id: 0,
        product_id: null,
        product_name: 'Kundan Bridal Set (26mm Test)',
        unit_price_cents: 249900,
        quantity: 1,
        line_total_cents: 249900,
        category_id: null
      }
    ]
  }

  const html = buildThermalReceiptHtml(sampleSale, settings, width)
  return printHtmlInHiddenWindow(html, target, true, 1, width)
}

export const POSIFLOW_SUPPORTED_SIZES: Array<{
  id: Exclude<LabelPaperSize, 'auto'>
  widthMm: number
  heightMm: number
  label: string
}> = [
  { id: '38x15mm', widthMm: 38, heightMm: 15, label: '38 × 15 mm' },
  { id: '50x12mm', widthMm: 50, heightMm: 12, label: '50 × 12 mm' },
  { id: '38x25mm', widthMm: 38, heightMm: 25, label: '38 × 25 mm' },
  { id: '50x25mm', widthMm: 50, heightMm: 25, label: '50 × 25 mm' },
  { id: '38x38mm', widthMm: 38, heightMm: 38, label: '38 × 38 mm' },
  { id: '50x30mm', widthMm: 50, heightMm: 30, label: '50 × 30 mm' },
  { id: '50x50mm', widthMm: 50, heightMm: 50, label: '50 × 50 mm' }
]

function matchClosestPosiflowSize(wMm: number, hMm: number): Exclude<LabelPaperSize, 'auto'> {
  let best: Exclude<LabelPaperSize, 'auto'> = '38x25mm'
  let bestDist = Infinity
  for (const s of POSIFLOW_SUPPORTED_SIZES) {
    const dist = Math.abs(s.widthMm - wMm) + Math.abs(s.heightMm - hMm)
    if (dist < bestDist) {
      bestDist = dist
      best = s.id
    }
  }
  return best
}

export async function detectLabelSize(deviceName?: string | null): Promise<{
  size: LabelPaperSize
  widthMm: number
  heightMm: number
  source: string
}> {
  const settings = getSettings()
  const target = (deviceName || settings.printer_device_name || '').trim()

  try {
    if (process.platform === 'win32') {
      const safeName = target.replace(/'/g, "''")
      const psCmd = safeName
        ? `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_PrinterConfiguration | Where-Object { $_.Name -like '*${safeName}*' } | Select-Object -First 1 Name, PaperSize, PaperWidth, PaperLength | ConvertTo-Json -Compress"`
        : `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_PrinterConfiguration | Select-Object -First 5 Name, PaperSize, PaperWidth, PaperLength | ConvertTo-Json -Compress"`
      const { stdout } = await execAsync(psCmd, { timeout: 2200 })
      if (stdout && stdout.trim()) {
        const parsed = JSON.parse(stdout.trim())
        const item = Array.isArray(parsed) ? parsed[0] : parsed
        if (item) {
          const paperSizeStr = String(item.PaperSize || '')
          const dimMatch = paperSizeStr.match(/(\d{2})\s*[x×*]\s*(\d{2})/i)
          if (dimMatch) {
            const w = Number(dimMatch[1])
            const h = Number(dimMatch[2])
            const matched = matchClosestPosiflowSize(w, h)
            const spec = POSIFLOW_SUPPORTED_SIZES.find((s) => s.id === matched)!
            return {
              size: matched,
              widthMm: spec.widthMm,
              heightMm: spec.heightMm,
              source: `Printer driver (${paperSizeStr})`
            }
          }
          // PaperWidth and PaperLength in Win32_PrinterConfiguration are in tenths of a millimeter
          const wMm = Math.round(Number(item.PaperWidth || 0) / 10)
          const hMm = Math.round(Number(item.PaperLength || 0) / 10)
          if (wMm >= 20 && wMm <= 65 && hMm >= 10 && hMm <= 65) {
            const matched = matchClosestPosiflowSize(wMm, hMm)
            const spec = POSIFLOW_SUPPORTED_SIZES.find((s) => s.id === matched)!
            return {
              size: matched,
              widthMm: spec.widthMm,
              heightMm: spec.heightMm,
              source: `Printer spooler (${wMm}×${hMm}mm)`
            }
          }
        }
      }
    } else if (process.platform === 'darwin' || process.platform === 'linux') {
      if (target) {
        const { stdout } = await execAsync(`lpoptions -p "${target.replace(/"/g, '')}"`, {
          timeout: 1500
        })
        const m = stdout.match(/PageSize[^\s]*?(\d{2})[xX](\d{2})/i)
        if (m) {
          const matched = matchClosestPosiflowSize(Number(m[1]), Number(m[2]))
          const spec = POSIFLOW_SUPPORTED_SIZES.find((s) => s.id === matched)!
          return {
            size: matched,
            widthMm: spec.widthMm,
            heightMm: spec.heightMm,
            source: 'CUPS driver media size'
          }
        }
      }
    }
  } catch {
    // Fallback to universal 38x25mm / 50x25mm safe core
  }

  return {
    size: '38x25mm',
    widthMm: 38,
    heightMm: 25,
    source: 'POSiFLOW PSF20 Auto-Calibrated (38×25 / 50×25 mm Safe Core)'
  }
}

async function generateCleanBarcodeBarsDataUri(sku: string): Promise<string> {
  const cleanSku = sku.trim() || '0000000000000'
  const isValidEan13 =
    /^\d{12}$/.test(cleanSku) ||
    (/^\d{13}$/.test(cleanSku) && cleanSku[12] === ean13CheckDigit(cleanSku.slice(0, 12)))

  try {
    const buf = await bwipjs.toBuffer({
      bcid: isValidEan13 ? 'ean13' : 'code128',
      text: cleanSku,
      scale: 4,
      height: 8,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0
    })
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    const buf = await bwipjs.toBuffer({
      bcid: 'code128',
      text: cleanSku,
      scale: 4,
      height: 8,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0
    })
    return `data:image/png;base64,${buf.toString('base64')}`
  }
}

interface LabelItemData {
  name: string
  sku: string
  price_cents: number
}

function resolveLabelGeometry(
  rawSize?: LabelPaperSize | '25mm' | '26mm' | '26mm-narrow'
): {
  resolvedId: Exclude<LabelPaperSize, 'auto'>
  pageWidthMm: number
  pageHeightMm: number
  coreWidthMm: number
  coreHeightMm: number
  barHeightMm: number
  nameFontPx: number
  skuFontPx: number
  priceFontPx: number
} {
  const norm: Exclude<LabelPaperSize, 'auto'> =
    !rawSize || rawSize === 'auto' || rawSize === '25mm' || rawSize === '26mm-narrow'
      ? '38x25mm'
      : rawSize === '26mm'
        ? '50x25mm'
        : rawSize

  switch (norm) {
    case '50x12mm':
      return {
        resolvedId: '50x12mm',
        pageWidthMm: 50,
        pageHeightMm: 12,
        coreWidthMm: 36,
        coreHeightMm: 8.8,
        barHeightMm: 3.6,
        nameFontPx: 6.5,
        skuFontPx: 5.5,
        priceFontPx: 7
      }
    case '38x15mm':
      return {
        resolvedId: '38x15mm',
        pageWidthMm: 38,
        pageHeightMm: 15,
        coreWidthMm: 30,
        coreHeightMm: 10.8,
        barHeightMm: 4.5,
        nameFontPx: 7,
        skuFontPx: 6,
        priceFontPx: 7.5
      }
    case '38x25mm':
      return {
        resolvedId: '38x25mm',
        pageWidthMm: 38,
        pageHeightMm: 25,
        coreWidthMm: 30,
        coreHeightMm: 17.2,
        barHeightMm: 7.5,
        nameFontPx: 8.5,
        skuFontPx: 7,
        priceFontPx: 9.5
      }
    case '50x25mm':
      return {
        resolvedId: '50x25mm',
        pageWidthMm: 50,
        pageHeightMm: 25,
        coreWidthMm: 34,
        coreHeightMm: 17.5,
        barHeightMm: 7.8,
        nameFontPx: 9,
        skuFontPx: 7.5,
        priceFontPx: 10
      }
    case '50x30mm':
      return {
        resolvedId: '50x30mm',
        pageWidthMm: 50,
        pageHeightMm: 30,
        coreWidthMm: 38,
        coreHeightMm: 21.5,
        barHeightMm: 9.8,
        nameFontPx: 9.5,
        skuFontPx: 8,
        priceFontPx: 10.5
      }
    case '38x38mm':
      return {
        resolvedId: '38x38mm',
        pageWidthMm: 38,
        pageHeightMm: 38,
        coreWidthMm: 31,
        coreHeightMm: 27,
        barHeightMm: 12,
        nameFontPx: 10,
        skuFontPx: 8,
        priceFontPx: 11
      }
    case '50x50mm':
      return {
        resolvedId: '50x50mm',
        pageWidthMm: 50,
        pageHeightMm: 50,
        coreWidthMm: 40,
        coreHeightMm: 36,
        barHeightMm: 15,
        nameFontPx: 11,
        skuFontPx: 9,
        priceFontPx: 12.5
      }
  }
}

async function buildBarcodeLabelsHtmlFromItems(
  items: LabelItemData[],
  rawSize: LabelPaperSize | '25mm' | '26mm' | '26mm-narrow' = 'auto',
  copiesPerProduct = 1
): Promise<{ html: string; totalStickers: number; resolvedSize: Exclude<LabelPaperSize, 'auto'> }> {
  const settings = getSettings()
  const currency = settings.currency || 'INR'
  const money = (cents: number) => formatCurrency(cents, currency)
  const copiesCount = Math.max(1, Math.min(500, Math.floor(copiesPerProduct || 1)))
  const geom = resolveLabelGeometry(rawSize)

  if (!items.length) {
    throw new Error('No products available to print labels')
  }

  const labelBlocks: string[] = []
  for (const product of items) {
    const dataUri = await generateCleanBarcodeBarsDataUri(product.sku)

    const stickerHtml = `
      <div class="sticker-page">
        <div class="sticker-core">
          <div class="prod-name">${escapeHtml(product.name)}</div>
          <div class="brc-wrap">
            <img src="${dataUri}" class="brc-img" alt="${escapeHtml(product.sku)}" />
          </div>
          <div class="sku-txt">${escapeHtml(product.sku)}</div>
          <div class="price-txt">${escapeHtml(money(product.price_cents))}</div>
        </div>
      </div>
    `
    for (let c = 0; c < copiesCount; c++) {
      labelBlocks.push(stickerHtml)
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>POSiFLOW PSF20 ${geom.resolvedId} Barcode Labels</title>
  <style>
    @page {
      size: ${geom.pageWidthMm}mm ${geom.pageHeightMm}mm;
      margin: 0mm !important;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #ffffff;
      color: #000000;
      font-family: 'Arial', 'Helvetica Neue', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sticker-page {
      width: ${geom.pageWidthMm}mm;
      height: ${geom.pageHeightMm}mm;
      max-width: 100%;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
    }
    .sticker-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .sticker-core {
      width: ${geom.coreWidthMm}mm;
      max-width: 86%;
      max-height: ${geom.coreHeightMm}mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.45mm;
      overflow: hidden;
    }
    .prod-name {
      font-size: ${geom.nameFontPx}px;
      font-weight: 900;
      line-height: 1.08;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #000000;
    }
    .brc-wrap {
      width: 86%;
      height: ${geom.barHeightMm}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin: 0.2mm 0;
    }
    .brc-img {
      width: 100%;
      height: 100%;
      object-fit: fill;
      image-rendering: pixelated;
      display: block;
    }
    .sku-txt {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: ${geom.skuFontPx}px;
      font-weight: 800;
      letter-spacing: 0.6px;
      line-height: 1;
      color: #000000;
    }
    .price-txt {
      font-size: ${geom.priceFontPx}px;
      font-weight: 900;
      line-height: 1.08;
      color: #000000;
      margin-top: 0.15mm;
    }
  </style>
</head>
<body>
  ${labelBlocks.join('\n')}
</body>
</html>`

  return { html, totalStickers: labelBlocks.length, resolvedSize: geom.resolvedId }
}

async function buildBarcodeLabelsHtml(
  productIds?: number[],
  labelSize: LabelPaperSize | '25mm' | '26mm' | '26mm-narrow' = 'auto',
  copiesPerProduct = 1
): Promise<{ html: string; totalStickers: number; resolvedSize: Exclude<LabelPaperSize, 'auto'> }> {
  const products =
    productIds && productIds.length > 0
      ? productIds
          .map((id) => getProduct(id))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
      : listProducts()

  return buildBarcodeLabelsHtmlFromItems(
    products.map((p) => ({ name: p.name, sku: p.sku, price_cents: p.price_cents })),
    labelSize,
    copiesPerProduct
  )
}

export async function getBarcodeLabelHtml(
  productId: number,
  labelSize: LabelPaperSize | '25mm' | '26mm' | '26mm-narrow' = 'auto'
): Promise<string> {
  const { html } = await buildBarcodeLabelsHtml([productId], labelSize, 1)
  return html
}

/**
 * Prints barcode sticker labels directly onto the POSiFLOW PSF20 thermal label printer.
 * When labelSize is 'auto' (or omitted), automatically detects the printer's configured label size.
 */
export async function printBarcodeLabels(
  options: PrintLabelsOptions
): Promise<{ success: boolean; printerName: string; detectedSize?: LabelPaperSize }> {
  const settings = getSettings()
  const target =
    options.deviceName !== undefined ? options.deviceName : settings.printer_device_name
  const copies = Math.max(1, Math.min(500, Math.floor(options.copies ?? 1)))

  let activeSize: LabelPaperSize | '25mm' | '26mm' | '26mm-narrow' = options.labelSize || 'auto'
  if (activeSize === 'auto') {
    const detected = await detectLabelSize(target)
    activeSize = detected.size
  }

  const { html, totalStickers, resolvedSize } = await buildBarcodeLabelsHtml(
    options.productIds,
    activeSize,
    copies
  )

  const res = await printHtmlInHiddenWindow(
    html,
    target,
    options.silent ?? true,
    1,
    resolvedSize
  )
  if (res.success) {
    logActivity(
      'labels.print',
      `Printed ${totalStickers} (${resolvedSize}) barcode label(s) on ${res.printerName}`
    )
  }
  return { ...res, detectedSize: resolvedSize }
}

/**
 * Prints 2 pieces (x2 copies) of a sample product barcode label (Name + Barcode + Price)
 * directly to the POSiFLOW PSF20 (Bluetooth / USB) for instant calibration & clarity testing.
 */
export async function testLabelPrint(
  deviceName?: string | null,
  labelSize: LabelPaperSize = 'auto'
): Promise<{ success: boolean; printerName: string; detectedSize?: LabelPaperSize }> {
  const settings = getSettings()
  const target = deviceName !== undefined ? deviceName : settings.printer_device_name

  let activeSize: LabelPaperSize = labelSize || 'auto'
  if (activeSize === 'auto') {
    const detected = await detectLabelSize(target)
    activeSize = detected.size
  }

  const sampleItems: LabelItemData[] = [
    {
      name: 'Earings',
      sku: '7120413779034',
      price_cents: 14900
    }
  ]

  const { html, resolvedSize } = await buildBarcodeLabelsHtmlFromItems(
    sampleItems,
    activeSize,
    2 // x2 pieces as requested
  )

  const res = await printHtmlInHiddenWindow(html, target, true, 1, resolvedSize)
  if (res.success) {
    logActivity(
      'labels.test',
      `Printed x2 sample barcode labels (${resolvedSize}) on ${res.printerName}`
    )
  }
  return { ...res, detectedSize: resolvedSize }
}
