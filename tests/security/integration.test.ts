import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from '../../src/hono'
import { secureHeaders } from '../../src/middleware/secure-headers'
import { rateLimit, smartCORS } from '../../src/middleware/security'

describe('Security Integration Tests', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it('should integrate multiple security middlewares', async () => {
    app.use('*', secureHeaders())
    app.use('*', smartCORS({ origin: 'https://example.com' }))
    app.use('*', rateLimit({ max: 10, windowMs: 60000 }))

    app.get('/secure', (c) => c.json({ message: 'secure endpoint' }))

    const res = await app.request('/secure', {
      headers: { 'Origin': 'https://example.com' }
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9')

    const data = await res.json()
    expect(data.message).toBe('secure endpoint')
  })

  it('should handle security middleware chain with authentication', async () => {
    app.use('*', secureHeaders())
    app.use('/api/*', async (c, next) => {
      const auth = c.req.header('Authorization')
      if (!auth || !auth.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      await next()
    })

    app.get('/api/protected', (c) => c.json({ data: 'protected content' }))
    app.get('/public', (c) => c.json({ data: 'public content' }))

    const publicRes = await app.request('/public')
    const unauthorizedRes = await app.request('/api/protected')
    const authorizedRes = await app.request('/api/protected', {
      headers: { 'Authorization': 'Bearer valid-token' }
    })

    expect(publicRes.status).toBe(200)
    expect(unauthorizedRes.status).toBe(401)
    expect(authorizedRes.status).toBe(200)

    expect(publicRes.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(authorizedRes.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
  })
})
