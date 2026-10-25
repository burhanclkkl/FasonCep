import test from 'node:test'
import assert from 'node:assert/strict'
import { orderStatus, isLate } from '../src/orderPresentation.ts'

test('order labels use one consistent set across list and detail',()=>{
  assert.equal(orderStatus(100,0,0).label,'Yeni')
  assert.equal(orderStatus(100,40,0).label,'Üretimde')
  assert.equal(orderStatus(100,100,40).label,'Teslime hazır')
  assert.equal(orderStatus(100,100,100).label,'Tamamlandı')
})
test('late flag is independent of production status and excludes completed orders',()=>{
  assert.equal(isLate('2026-10-24','2026-10-25',100,50),true)
  assert.equal(isLate('2026-10-24','2026-10-25',100,100),false)
  assert.equal(isLate('2026-10-25','2026-10-25',100,0),false)
  assert.equal(isLate('2026-10-26','2026-10-25',100,0),false)
})
