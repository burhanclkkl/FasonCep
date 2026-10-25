/** Money is compared and summed in integer kuruş. */
export const toCents = (value: number) => Math.round((value + Number.EPSILON) * 100)
export const lineCents = (quantity: number, price: number) => quantity * toCents(price)
export const formatMoney = (value: number) => value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

/** Accept either decimal separator, without ambiguous thousands separators. */
export function parseAmount(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return amount > 0 && Number.isSafeInteger(toCents(amount)) ? amount : null
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 9999) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
