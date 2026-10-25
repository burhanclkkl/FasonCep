import { toCents, lineCents, formatMoney } from './amounts.ts'
export type DeleteKind = 'customers' | 'orders' | 'production' | 'deliveries' | 'accounts'
export type DeleteTarget = { kind: DeleteKind; id: string; label: string }
type Records = {
  customers: { id: string }[]
  orders: { id: string; customer: string; quantity: number; price: number }[]
  production: { id: string; order: string; quantity: number }[]
  deliveries: { id: string; order: string; quantity: number }[]
  payments: { id: string; customer: string; amount: number }[]
}

export function deletionBlockReason(target: DeleteTarget, records: Records): string | null {
  const { orders, production, deliveries, payments } = records
  const collection = target.kind === 'accounts' ? payments : records[target.kind]
  if (!collection.some(item => item.id === target.id)) return 'Bu kayıt artık bulunamıyor.'
  if (target.kind === 'customers' && (orders.some(o => o.customer === target.id) || payments.some(p => p.customer === target.id))) {
    return 'Müşteriye bağlı sipariş veya tahsilat var. Önce bağlı kayıtları kontrol edin.'
  }
  if (target.kind === 'orders') {
    const order = orders.find(o => o.id === target.id)!
    if (production.some(m => m.order === order.id) || deliveries.some(m => m.order === order.id)) {
      return 'Siparişe bağlı üretim veya teslimat var. Önce bağlı hareketleri kaldırın.'
    }
    const remainingTotal = orders.filter(o => o.customer === order.customer && o.id !== order.id).reduce((sum, o) => sum + lineCents(o.quantity, o.price), 0)
    const collected = payments.filter(p => p.customer === order.customer).reduce((sum, p) => sum + toCents(p.amount), 0)
    if (collected > remainingTotal) {
      return `Bu müşteriden ${formatMoney(collected / 100)} tahsil edilmiş. Sipariş silinince kalan sipariş tutarı ${formatMoney(remainingTotal / 100)} olacak. Aradaki ${formatMoney((collected - remainingTotal) / 100)} fark için tahsilat kayıtlarını kontrol edin. Tahsilatlar müşteriye bağlıdır; sipariş silinirken otomatik silinmez.`
    }
  }
  if (target.kind === 'production') {
    const movement = production.find(m => m.id === target.id)!
    const remaining = production.filter(m => m.order === movement.order && m.id !== movement.id).reduce((sum, m) => sum + m.quantity, 0)
    const delivered = deliveries.filter(m => m.order === movement.order).reduce((sum, m) => sum + m.quantity, 0)
    if (remaining < delivered) return 'Bu üretim silinirse üretilen adet teslim edilenin altına düşer. Önce ilgili teslimatları düzeltin.'
  }
  return null
}
