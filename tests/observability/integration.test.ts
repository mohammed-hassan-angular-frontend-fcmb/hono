import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from '../../src/hono'
import type { RequestIdVariables } from '../../src/middleware/request-id/request-id'

describe('Integration Check', () => {
  let app: Hono<{ Variables: RequestIdVariables }>

  beforeEach(() => {
    app = new Hono()
  })

  it('should return integration status', async () => {
    app.get('/health', (c) => c.json({ status: 'ok', service: 'integration' }))

    const res = await app.request('/health')
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.service).toBe('integration')
  })

  it('should handle multiple service endpoints', async () => {
    app.get('/api/status', (c) => c.json({ api: 'running' }))
    app.get('/db/status', (c) => c.json({ database: 'connected' }))

    const apiRes = await app.request('/api/status')
    const dbRes = await app.request('/db/status')

    expect(apiRes.status).toBe(200)
    expect(dbRes.status).toBe(200)

    const apiData = await apiRes.json()
    const dbData = await dbRes.json()

    expect(apiData.api).toBe('running')
    expect(dbData.database).toBe('connected')
  })

  it('should integrate with middleware chain', async () => {
    app.use('*', async (c, next) => {
      c.set('requestId', 'test-123')
      await next()
    })

    app.get('/integration', (c) => {
      return c.json({
        message: 'Integration working',
        requestId: c.get('requestId')
      })
    })

    const res = await app.request('/integration')
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.message).toBe('Integration working')
    expect(data.requestId).toBe('test-123')
  })
})
