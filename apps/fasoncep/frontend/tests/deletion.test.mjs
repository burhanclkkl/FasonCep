import test from 'node:test'
import assert from 'node:assert/strict'
import { deletionBlockReason } from '../src/deletion.ts'

const data = () => ({
  customers: [{id:'c1'}, {id:'c2'}],
  orders: [{id:'o1',customer:'c1',quantity:100,price:10}, {id:'o2',customer:'c1',quantity:50,price:10}],
  production: [{id:'p1',order:'o1',quantity:60}, {id:'p2',order:'o1',quantity:40}],
  deliveries: [{id:'d1',order:'o1',quantity:50}],
  payments: [{id:'pay1',customer:'c1',amount:600}],
})
const reason = (kind,id,records=data()) => deletionBlockReason({kind,id,label:id}, records)
test('customer dependencies are protected; unused customer can be deleted', () => {
  assert.ok(reason('customers','c1'))
  assert.equal(reason('customers','c2'),null)
})
test('orders with production or deliveries cannot be deleted', () => {
  assert.ok(reason('orders','o1'))
  const records=data(); records.production=[]
  assert.ok(reason('orders','o1',records))
})
test('order deletion cannot leave collected amount above remaining orders', () => {
  const records=data(); records.production=[]; records.deliveries=[]
  assert.ok(reason('orders','o1',records))
  assert.equal(reason('orders','o2',records),null)
  records.payments[0].amount=500
  assert.equal(reason('orders','o1',records),null)
})
test('production deletion keeps delivered quantity within production', () => {
  assert.ok(reason('production','p1'))
  assert.equal(reason('production','p2'),null)
  const records=data(); records.deliveries[0].quantity=40
  assert.equal(reason('production','p1',records),null)
})
test('delivery and payment reversals are allowed', () => {
  assert.equal(reason('deliveries','d1'),null)
  assert.equal(reason('accounts','pay1'),null)
})
test('missing records cannot be deleted', () => {
  for (const kind of ['customers','orders','production','deliveries','accounts']) assert.ok(reason(kind,'missing'))
})
test('other customers and orders do not block deletion', () => {
  const records=data(); records.orders.push({id:'o3',customer:'c2',quantity:10,price:5})
  assert.equal(reason('orders','o3',records),null)
})

test('deletion message explains collected, remaining, and excess amounts', () => {
  const records=data(); records.production=[]; records.deliveries=[]
  const message=reason('orders','o1',records)
  assert.match(message,/600,00/)
  assert.match(message,/500,00/)
  assert.match(message,/100,00/)
})
test('decimal-priced remaining orders do not incorrectly block deletion', () => {
  const records=data(); records.production=[]; records.deliveries=[]
  records.orders=[{id:'o1',customer:'c1',quantity:1,price:1},{id:'o2',customer:'c1',quantity:3,price:0.29}]
  records.payments=[{id:'pay1',customer:'c1',amount:0.87}]
  assert.equal(reason('orders','o1',records),null)
  records.payments[0].amount=0.88
  assert.ok(reason('orders','o1',records))
})
test('removing the blocking payment allows order deletion without cascading', () => {
  const records=data(); records.production=[]; records.deliveries=[]
  assert.ok(reason('orders','o1',records))
  assert.equal(reason('accounts','pay1',records),null)
  records.payments=[]
  assert.equal(reason('orders','o1',records),null)
  assert.equal(records.orders.length,2)
})
