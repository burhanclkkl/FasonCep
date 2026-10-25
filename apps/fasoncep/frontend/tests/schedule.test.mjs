import test from 'node:test'
import assert from 'node:assert/strict'
import { istanbulToday, weekEnd, dueBucket } from '../src/schedule.ts'

test('Istanbul day changes independently of UTC day', () => {
  assert.equal(istanbulToday(new Date('2026-10-25T20:59:59Z')),'2026-10-25')
  assert.equal(istanbulToday(new Date('2026-10-25T21:00:00Z')),'2026-10-26')
})
test('deadline buckets do not overlap and current week ends Sunday', () => {
  assert.equal(weekEnd('2026-10-19'),'2026-10-25')
  assert.equal(weekEnd('2026-10-25'),'2026-10-25')
  assert.equal(dueBucket('2026-10-20','2026-10-21'),'late')
  assert.equal(dueBucket('2026-10-21','2026-10-21'),'today')
  assert.equal(dueBucket('2026-10-25','2026-10-21'),'week')
  assert.equal(dueBucket('2026-10-26','2026-10-21'),'later')
})
test('week calculation works across year and leap-month boundaries', () => {
  assert.equal(weekEnd('2026-12-31'),'2027-01-03')
  assert.equal(dueBucket('2027-01-01','2026-12-31'),'week')
  assert.equal(weekEnd('2024-02-29'),'2024-03-03')
})
