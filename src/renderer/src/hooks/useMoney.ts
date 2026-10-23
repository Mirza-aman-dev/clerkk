import { useSettings } from '../stores/settings'
import { formatCurrency } from '../../../shared/util'

export function useMoney(): (cents: number) => string {
  const currency = useSettings((s) => s.settings?.currency ?? 'INR')
  return (cents: number) => formatCurrency(cents, currency)
}

export function useCurrencyCode(): string {
  return useSettings((s) => s.settings?.currency ?? 'INR')
}

export function useTaxRate(): number {
  return useSettings((s) => s.settings?.tax_rate ?? 0)
}
