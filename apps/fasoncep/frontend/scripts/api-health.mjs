// Marketing mode intentionally hides OpenAPI and the business APIs.
export async function compatibleApi(apiUrl, fetcher = fetch) {
  const request = path => fetcher(`${apiUrl}${path}`, { signal: AbortSignal.timeout(800) })
  const response = await request('/api/health')
  const body = await response.json()
  if (!response.ok || body.status !== 'ok' || body.mode !== 'local') return false
  const configResponse = await request('/api/public-config')
  if (!configResponse.ok) throw new Error('OUTDATED_API')
  const config = await configResponse.json()
  if (!['marketing', 'application'].includes(config.mode) || typeof config.accepting_requests !== 'boolean') throw new Error('OUTDATED_API')
  if (config.mode === 'marketing') return true
  const schema = await request('/api/openapi.json')
  if (!schema.ok) throw new Error('OUTDATED_API')
  const spec = await schema.json()
  const required = [
    ['/api/workshops', 'post'],
    ['/api/workshops/{workshop_id}', 'put'],
    ['/api/workshops/{workshop_id}/operations', 'get'],
    ['/api/workshops/{workshop_id}/operations/{kind}', 'post'],
    ['/api/workshops/{workshop_id}/export.xlsx', 'get'],
    ['/api/auth/register', 'post'],
    ['/api/demo-requests', 'post'],
  ]
  if (!required.every(([path, method]) => spec.paths?.[path]?.[method])) throw new Error('OUTDATED_API')
  return true
}
