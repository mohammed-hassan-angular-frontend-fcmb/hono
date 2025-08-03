/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from '../../src/hono'
import { rateLimit } from '../../src/middleware/security'

describe('Rate Limit Middleware', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  it('should allow requests within rate limit', async () => {
    app.use('*', rateLimit({ max: 5, windowMs: 60000 }))
    app.get('/test', (c) => c.text('OK'))

    const res = await app.request('/test')

    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4')
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
    expect(await res.text()).toBe('OK')
  })

  it('should block requests exceeding rate limit', async () => {
    app.use('*', rateLimit({ max: 2, windowMs: 60000 }))
    app.get('/test', (c) => c.text('OK'))

    // Make requests up to the limit
    await app.request('/test')
    await app.request('/test')

    // This should be blocked
    const res = await app.request('/test')

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()

    const data = await res.json()
    expect(data.error).toBe('Too Many Requests')
  })

  it('should use custom key generator', async () => {
    const customKeyGen = (c: any) => c.req.header('user-id') || 'anonymous'

    app.use('*', rateLimit({
      max: 1,
      windowMs: 60000,
      keyGenerator: customKeyGen
    }))
    app.get('/test', (c) => c.text('OK'))

    // First request with user-id should succeed
    const res1 = await app.request('/test', {
      headers: { 'user-id': 'user1' }
    })
    expect(res1.status).toBe(200)

    // Second request with same user-id should be blocked
    const res2 = await app.request('/test', {
      headers: { 'user-id': 'user1' }
    })
    expect(res2.status).toBe(429)

    // Request with different user-id should succeed
    const res3 = await app.request('/test', {
      headers: { 'user-id': 'user2' }
    })
    expect(res3.status).toBe(200)
  })

  it('should handle custom onLimitReached callback', async () => {
    const customResponse = (c: any) => c.text('Custom limit exceeded', 429)

    app.use('*', rateLimit({
      max: 1,
      windowMs: 60000,
      onLimitReached: customResponse
    }))
    app.get('/test', (c) => c.text('OK'))

    await app.request('/test') // First request
    const res = await app.request('/test') // Second request should trigger custom response

    expect(res.status).toBe(429)
    expect(await res.text()).toBe('Custom limit exceeded')
  })
})
