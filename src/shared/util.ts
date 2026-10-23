// Shared helpers usable from both main and renderer.

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

export function amountToCents(amount: number | string): number {
  const n = typeof amount === 'string' ? Number(amount) : amount
  return Math.round(n * 100)
}

export function centsToAmount(cents: number): number {
  return cents / 100
}

export function roundCents(n: number): number {
  return Math.round(n)
}

export function taxFromSubtotal(subtotalCents: number, taxRatePercent: number): number {
  if (!taxRatePercent) return 0
  return Math.round((subtotalCents * taxRatePercent) / 100)
}

const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'en-AE',
  SAR: 'en-SA',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
  PKR: 'en-PK',
  BDT: 'en-BD',
  LKR: 'en-LK',
  NPR: 'en-NP'
}

export function formatCurrency(cents: number, currencyCode: string): string {
  const locale = CURRENCY_LOCALES[currencyCode] ?? 'en-US'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(centsToAmount(cents))
  } catch {
    return `${centsToAmount(cents).toFixed(2)} ${currencyCode}`
  }
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDateShort(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function relativeTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return '—'
  const diff = Date.now() - d
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return formatDateShort(iso)
}

export function ean13CheckDigit(base12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = Number(base12[i])
    sum += i % 2 === 0 ? d : d * 3
  }
  return String((10 - (sum % 10)) % 10)
}
