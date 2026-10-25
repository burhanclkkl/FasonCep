import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAmount, toCents, lineCents, validDate } from '../src/amounts.ts'

test('Turkish and dot decimal input produce identical amounts', () => {
  assert.equal(parseAmount(' 12,50 '),12.5)
  assert.equal(parseAmount('12.50'),12.5)
  assert.equal(parseAmount('0,01'),0.01)
})
test('invalid, negative, over-precision and ambiguous amounts are rejected', () => {
  for (const text of ['', ' ', '0', '-1', 'NaN', 'Infinity', '1e3', '1.234', '1,234', '1.234,56', '12abc', '9'.repeat(30)]) {
    assert.equal(parseAmount(text),null,text)
  }
})
test('full remaining payment is accepted at decimal boundary', () => {
  const invoice=lineCents(3,0.1)
  const remaining=invoice-toCents(0.1)
  assert.equal(remaining,20)
  assert.ok(toCents(parseAmount('0,20'))<=remaining)
  assert.ok(toCents(parseAmount('0,21'))>remaining)
  assert.equal(lineCents(3,0.29),87)
})
test('calendar dates must exist, including leap years', () => {
  for (const date of ['2026-10-25','2024-02-29','1900-01-01']) assert.equal(validDate(date),true,date)
  for (const date of ['2026-02-29','2026-02-30','2026-13-01','2026-1-01','1899-12-31','', 'not-a-date']) assert.equal(validDate(date),false,date)
})
