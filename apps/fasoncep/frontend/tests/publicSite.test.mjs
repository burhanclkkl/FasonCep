import {createDemoData} from '../src/demoData.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {renderToString} from 'react-dom/server'
const temporary=await mkdtemp(join(resolve('node_modules'),'.public-tests-'))
let components
try {
  const outfile=join(temporary,'public.mjs')
  await build({stdin:{contents:"export * from './src/PublicSite'; export {default as Operations} from './src/Operations'; export {default as OrderDetail} from './src/OrderDetail';",resolveDir:resolve('.'),loader:'tsx'},bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',outfile})
  components=await import(pathToFileURL(outfile).href)
} finally {await rm(temporary,{recursive:true,force:true})}
const config={mode:'marketing',accepting_requests:false,operator_name:'',contact_email:'',retention_days:90}
test('unconfigured request form is disabled and never requests a password',()=>{
  const html=renderToString(React.createElement(components.RequestForm,{config,navigate:()=>{}}))
  assert.match(html,/Demo talepleri yakında açılacak/)
  assert.match(html,/disabled=""/)
  assert.doesNotMatch(html,/type="password"|name="password"/)
  assert.match(html,/href="\/aydinlatma"/)
})
test('sample demo shows read-only examples without editable records',()=>{
  const html=renderToString(React.createElement(components.SampleDemo,{navigate:()=>{}}))
  assert.match(html,/Örnek Dikim Atölyesi/)
  assert.match(html,/DASHBOARD/)
  assert.match(html,/Cari &amp; Tahsilat/)
  assert.match(html,/Son siparişler/)
  assert.match(html,/Gerçek kayıt içermez/)
  assert.match(html,/dışa aktarma kapalıdır/)
  assert.doesNotMatch(html,/<input|<textarea|<form/)
  assert.match(html,/side-links/)
})

test('all real application modules render sample records through the shared Operations component',()=>{
  const data=createDemoData(1,'2026-10-25')
  for(const page of ['overview','customers','orders','production','deliveries','accounts']) {
    const html=renderToString(React.createElement(components.Operations,{workshopId:1,name:'Örnek Atölye',page,navigate:()=>{},settings:()=>{},previewData:data}))
    assert.doesNotMatch(html,/Atölye kayıtları yükleniyor|Kayıtlar yüklenemedi/)
    assert.match(html,page==='production'||page==='deliveries'?/Örnek Tekstil/:/Örnek Moda/)
    if(page!=='overview')assert.match(html,/Listede ara/)
    assert.doesNotMatch(html,/<form/)
  }
})
test('sample orders use the real detail page including variants and customer payment history',()=>{
  const data=createDemoData(1,'2026-10-25')
  const html=renderToString(React.createElement(components.OrderDetail,{order:data.orders[1],...data,onBack:()=>{},onEdit:()=>{},onAction:()=>{}}))
  assert.match(html,/Renk \/ beden dağılımı/)
  assert.match(html,/Müşteri tahsilat geçmişi/)
  assert.match(html,/Üretim ve teslimat geçmişi/)
})
