import test from 'node:test'
import assert from 'node:assert/strict'
import { compatibleApi } from '../scripts/api-health.mjs'
const origin='http://127.0.0.1:8765'
function server(config,{healthy=true,schema=null,configStatus=200}={}) {
  const paths=[]
  return {paths, fetcher:async url=>{
    const path=new URL(url).pathname;paths.push(path)
    if(path==='/api/health')return Response.json({status:healthy?'ok':'failed',mode:'local'})
    if(path==='/api/public-config')return Response.json(config,{status:configStatus})
    if(path==='/api/openapi.json')return Response.json(schema||{detail:'Not found'},{status:schema?200:404})
    throw Error('Unexpected path')
  }}
}
test('marketing API is ready even though OpenAPI is intentionally closed',async()=>{
  const api=server({mode:'marketing',accepting_requests:false})
  assert.equal(await compatibleApi(origin,api.fetcher),true)
  assert.deepEqual(api.paths,['/api/health','/api/public-config'])
})
test('unhealthy API does not trigger schema probing',async()=>{
  const api=server(null,{healthy:false})
  assert.equal(await compatibleApi(origin,api.fetcher),false)
  assert.deepEqual(api.paths,['/api/health'])
})
test('old API without public mode config needs a restart',async()=>{
  const api=server({detail:'Not found'},{configStatus:404})
  await assert.rejects(compatibleApi(origin,api.fetcher),/OUTDATED_API/)
})
test('application mode still verifies business API compatibility',async()=>{
  const paths=Object.fromEntries([
    ['/api/workshops','post'],['/api/workshops/{workshop_id}','put'],
    ['/api/workshops/{workshop_id}/operations','get'],['/api/workshops/{workshop_id}/operations/{kind}','post'],
    ['/api/workshops/{workshop_id}/export.xlsx','get'],['/api/auth/register','post'],['/api/demo-requests','post'],
  ].map(([path,method])=>[path,{[method]:{}}]))
  const api=server({mode:'application',accepting_requests:false},{schema:{paths}})
  assert.equal(await compatibleApi(origin,api.fetcher),true)
  const outdated=server({mode:'application',accepting_requests:false})
  await assert.rejects(compatibleApi(origin,outdated.fetcher),/OUTDATED_API/)
})
