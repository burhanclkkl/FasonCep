import test from 'node:test'
import assert from 'node:assert/strict'
import {marketingRedirect} from '../src/publicRouting.ts'
test('entry routes do not redirect before the server mode is known',()=>{
  for(const path of ['/giris','/kayit','/uygulama']) {
    assert.equal(marketingRedirect(path,'marketing',false),null)
    assert.equal(marketingRedirect(path,'application',true),null)
  }
})
test('only confirmed marketing mode redirects application entry routes',()=>{
  assert.equal(marketingRedirect('/giris','marketing',true),'/demo-talebi')
  assert.equal(marketingRedirect('/kayit','marketing',true),'/demo-talebi')
  assert.equal(marketingRedirect('/uygulama','marketing',true),'/demo')
  assert.equal(marketingRedirect('/demo','marketing',true),null)
})
