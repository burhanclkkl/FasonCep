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
  await build({entryPoints:['src/PublicSite.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',outfile})
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
  assert.match(html,/ÖRNEK ATÖLYE/)
  assert.match(html,/SP-1042/)
  assert.match(html,/gerçek müşteri/)
  assert.match(html,/bu tanıtım demosunda kapalıdır/)
  assert.doesNotMatch(html,/<input|<textarea|<form/)
  assert.match(html,/tabpanel/)
})
