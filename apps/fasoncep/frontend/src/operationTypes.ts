export type Customer = { id: string; name: string; contact: string; phone: string; email: string }
export type Variant = { color: string; size: string; quantity: number }
export type Order = { id: string; customer: string; model: string; quantity: number; price: number; due: string; notes: string; photo: string | null; variants: Variant[] }
export type Movement = { id: string; order: string; quantity: number; date: string }
export type Payment = { id: string; customer: string; amount: number; date: string }
export type OperationData = { customers: Customer[]; orders: Order[]; production: Movement[]; deliveries: Movement[]; payments: Payment[] }
