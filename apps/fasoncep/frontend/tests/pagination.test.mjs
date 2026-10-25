import test from 'node:test'
import assert from 'node:assert/strict'
import { pagination } from '../src/pageMath.ts'

test('page ranges show all records exactly once',()=>{
  const source=Array.from({length:53},(_,i)=>i)
  const all=[]
  for(let page=1;page<=6;page++){
    const info=pagination(source.length,page,10)
    all.push(...source.slice(info.offset,info.offset+info.pageSize))
  }
  assert.deepEqual(all,source)
  assert.equal(pagination(53,6,10).start,51)
  assert.equal(pagination(53,6,10).end,53)
})
test('deletion and shrinking search results clamp to valid pages',()=>{
  assert.equal(pagination(20,3,10).page,2)
  assert.equal(pagination(3,5,10).page,1)
  const empty=pagination(0,9,10)
  assert.equal(empty.page,1)
  assert.equal(empty.start,0)
  assert.equal(empty.end,0)
})
test('page sizes and page number gaps remain bounded',()=>{
  assert.equal(pagination(53,1,20).pageCount,3)
  assert.equal(pagination(53,1,50).pageCount,2)
  assert.equal(pagination(53,1,0).pageSize,10)
  assert.deepEqual(pagination(1000,50,10).numbers,[1,48,49,50,51,52,100])
  assert.equal(pagination(5,-1,10).page,1)
})
