import test from 'node:test'
import assert from 'node:assert/strict'
import {createDemoData} from '../src/demoData.ts'

test('sample data respects order, production, delivery and receivable limits',()=>{
  for(const workshop of [1,2]) {
    const data=createDemoData(workshop,'2026-10-25')
    assert.ok(data.orders.length>10)
    for(const order of data.orders) {
      const produced=data.production.filter(item=>item.order===order.id).reduce((sum,item)=>sum+item.quantity,0)
      const delivered=data.deliveries.filter(item=>item.order===order.id).reduce((sum,item)=>sum+item.quantity,0)
      assert.ok(produced<=order.quantity && delivered<=produced)
      assert.equal(order.variants.reduce((sum,item)=>sum+item.quantity,0),order.quantity)
      assert.ok(data.customers.some(customer=>customer.id===order.customer))
    }
    for(const customer of data.customers) {
      const billed=data.orders.filter(item=>item.customer===customer.id).reduce((sum,item)=>sum+item.quantity*item.price,0)
      const paid=data.payments.filter(item=>item.customer===customer.id).reduce((sum,item)=>sum+item.amount,0)
      assert.ok(paid<=billed)
    }
    assert.ok(data.orders.some(item=>item.due<'2026-10-25'))
    assert.ok(data.orders.some(item=>item.due==='2026-10-25'))
  }
})
test('workshops use distinct records and switching cannot mix their histories',()=>{
  const first=createDemoData(1,'2026-10-25'), second=createDemoData(2,'2026-10-25')
  const ids=new Set(first.orders.map(item=>item.id))
  assert.ok(second.orders.every(item=>!ids.has(item.id)))
  assert.notEqual(first.orders[0].model,second.orders[0].model)
  assert.deepEqual(first,createDemoData(1,'2026-10-25'))
})
