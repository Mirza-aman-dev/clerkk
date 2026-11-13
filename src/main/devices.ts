import { BrowserWindow, WebContents, app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import {
  AppSettings,
  PrinterDeviceInfo,
  PrintReceiptOptions,
  ReceiptPaperWidth,
  Sale,
  UsbScannerDeviceInfo
} from '../shared/types'
import { getSale } from './db/sales'
import { getSettings } from './db/settings'
import { logActivity } from './db'
import { formatDate, formatCurrency } from '../shared/util'

const execAsync = promisify(exec)

const THERMAL_KEYWORDS = [
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

  if (reasons.includes('offline') || stateStr.includes('offline') || status === 8 || status === 128 || status === 4096) {
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
  if (status === 0 || stateStr === '3' || stateStr === 'idle' || stateStr === 'normal' || !stateStr) {
    return { statusText: 'Ready', isConnected: true }
  }
  return { statusText: 'Ready', isConnected: true }
}

function isLikelyThermalPrinter(name: string, displayName: string, description: string, model: string): boolean {
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

    // Sort: connected thermal printers first, then default printer, then connected printers
    mapped.sort((a, b) => {
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
  ' zebra',
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
  ' fingerprint',
  'biometric',
  'sensor'
]

export async function listUsbScanners(): Promise<UsbScannerDeviceInfo[]> {
  const devices: UsbScannerDeviceInfo[] = []
  try {
    if (process.platform === 'win32') {
      // Query Windows PnP entities for USB Barcode Scanners and external USB HID input devices
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
        // UsagePage 1 Usage 6 = Keyboard, UsagePage 140 (0x8C) = Barcode Scanner
        const isScannerOrKeyboard =
          usagePage === 140 ||
          (usagePage === 1 && usage === 6) ||
          SCANNER_BRAND_KEYWORDS.some((k) => lower.includes(k))

        if (!isScannerOrKeyboard) continue

        const vid = vidMatch ? Number(vidMatch[1]).toString(16).toUpperCase().padStart(4, '0') : undefined
        const pid = pidMatch ? Number(pidMatch[1]).toString(16).toUpperCase().padStart(4, '0') : undefined
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

export function buildThermalReceiptHtml(
  sale: Sale,
  settings: AppSettings,
  paperWidth: ReceiptPaperWidth = '80mm'
): string {
  const currency = settings.currency || 'INR'
  const money = (cents: number) => formatCurrency(cents, currency)
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
    .divider-double {
      border-top: 2px solid #000000;
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

async function printHtmlInHiddenWindow(
  html: string,
  deviceName?: string | null,
  silent = true,
  copies = 1
): Promise<{ success: boolean; printerName: string }> {
  const tmpHtml = join(app.getPath('temp'), `clerkk-bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.html`)
  await fs.writeFile(tmpHtml, html, 'utf-8')

  const targetDevice = deviceName?.trim() || ''
  const isVirtual = VIRTUAL_PRINTER_KEYWORDS.some((k) => targetDevice.toLowerCase().includes(k))
  const useSilent = Boolean(targetDevice) && silent && !isVirtual

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
        reject(new Error('Printer timed out. Please verify the bill printer is powered on and connected.'))
      }
    }, 30000)

    win.webContents.once('did-finish-load', () => {
      // Small delay so fonts & images finish layout calculation
      setTimeout(() => {
        if (settled || win.isDestroyed()) return
        const printOpts: Electron.WebContentsPrintOptions = {
          silent: useSilent,
          printBackground: true,
          deviceName: targetDevice || undefined,
          copies: Math.max(1, copies),
          margins: { marginType: 'none' }
        }

        win.webContents.print(printOpts, (success, failureReason) => {
          if (settled) return
          if (!success && useSilent) {
            // Automatic fallback to native dialog with the printer pre-selected
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
      }, 180)
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
  const paperWidth = options.paperWidth || settings.receipt_paper_width || '80mm'
  const deviceName =
    options.deviceName !== undefined ? options.deviceName : settings.printer_device_name

  const html = buildThermalReceiptHtml(sale, settings, paperWidth)
  const res = await printHtmlInHiddenWindow(
    html,
    deviceName,
    options.silent ?? true,
    options.copies ?? 1
  )
  if (res.success) {
    logActivity('invoice.print', `Printed ${sale.invoice_number} on ${res.printerName} (${paperWidth})`)
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
  return buildThermalReceiptHtml(sale, settings, paperWidth || settings.receipt_paper_width || '80mm')
}

export async function testPrint(
  deviceName?: string | null,
  paperWidth?: ReceiptPaperWidth
): Promise<{ success: boolean; printerName: string }> {
  const settings = getSettings()
  const width = paperWidth || settings.receipt_paper_width || '80mm'
  const target = deviceName !== undefined ? deviceName : settings.printer_device_name

  const sampleSale: Sale = {
    id: 0,
    invoice_number: `${settings.invoice_prefix || 'INV'}-TEST`,
    customer_id: null,
    customer_name: 'Test Print Customer',
    customer_phone: null,
    customer_place: null,
    subtotal_cents: 25000,
    tax_cents: Math.round((25000 * (settings.tax_rate || 0)) / 100),
    total_cents: 25000 + Math.round((25000 * (settings.tax_rate || 0)) / 100),
    payment_method: 'cash',
    notes: 'Bill printer alignment & hardware test',
    created_at: new Date().toISOString(),
    is_voided: 0,
    items: [
      {
        id: 1,
        sale_id: 0,
        product_id: null,
        product_name: 'Sample POS Item 1',
        unit_price_cents: 15000,
        quantity: 1,
        line_total_cents: 15000,
        category_id: null
      },
      {
        id: 2,
        sale_id: 0,
        product_id: null,
        product_name: 'Sample POS Item 2',
        unit_price_cents: 5000,
        quantity: 2,
        line_total_cents: 10000,
        category_id: null
      }
    ]
  }

  const html = buildThermalReceiptHtml(sampleSale, settings, width)
  return printHtmlInHiddenWindow(html, target, true, 1)
}
