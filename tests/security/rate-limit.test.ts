// tests/security/rate-limit.test.ts
import { Hono } from 'hono'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit, createCloudflareKVStore } from '../../src/middleware/security'
import type { RateLimitInfo } from '../../src/middleware/security/types'

declare module 'hono' {
  interface ContextVariableMap {
    rateLimitInfo: RateLimitInfo
  }
}

describe('Rate Limiting Middleware', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    vi.clearAllMocks()
  })

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      app.use('*', rateLimit({ max: 5, windowMs: 60000 }))
      app.get('/', (c) => c.text('OK'))

      // Make 5 requests - all should succeed
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/')
        expect(res.status).toBe(200)
        expect(res.headers.get('X-RateLimit-Remaining')).toBe((4 - i).toString())
      }
    })

    it('should block requests exceeding limit', async () => {
      app.use('*', rateLimit({ max: 2, windowMs: 60000 }))
      app.get('/', (c) => c.text('OK'))

      // First 2 requests should succeed
      await app.request('/')
      await app.request('/')

      // Third request should be rate limited
      const res = await app.request('/')
      expect(res.status).toBe(429)

      const body = await res.json()
      expect(body.error).toBe('Too Many Requests')
      expect(res.headers.get('Retry-After')).toBeTruthy()
    })

    it('should use custom key generator', async () => {
      const keyGenerator = vi.fn((c) => c.req.header('User-ID') || 'anonymous')

      app.use('*', rateLimit({
        max: 1,
        windowMs: 60000,
        keyGenerator
      }))
      app.get('/', (c) => c.text('OK'))

      // Different users should have separate limits
      const req1 = new Request('/', { headers: { 'User-ID': 'user1' } })
      const req2 = new Request('/', { headers: { 'User-ID': 'user2' } })

      const res1 = await app.request(req1)
      const res2 = await app.request(req2)

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(keyGenerator).toHaveBeenCalledTimes(2)
    })

    it('should handle custom limit reached callback', async () => {
      const onLimitReached = vi.fn((c) =>
        c.json({ custom: 'rate limit exceeded' }, 429)
      )

      app.use('*', rateLimit({
        max: 1,
        windowMs: 60000,
        onLimitReached
      }))
      app.get('/', (c) => c.text('OK'))

      await app.request('/') // First request succeeds
      const res = await app.request('/') // Second request hits limit

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.custom).toBe('rate limit exceeded')
      expect(onLimitReached).toHaveBeenCalledTimes(1)
    })
  })

  describe('CloudflareKV Store Integration', () => {
    it('should work with Cloudflare KV store', async () => {
      const mockKV = {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined)
      }

      const store = createCloudflareKVStore(mockKV)

      app.use('*', rateLimit({ max: 2, windowMs: 60000, store }))
      app.get('/', (c) => c.text('OK'))

      await app.request('/')

      expect(mockKV.get).toHaveBeenCalledWith('rate_limit:unknown')
      expect(mockKV.put).toHaveBeenCalled()
    })
  })

  describe('Context Integration', () => {
    it('should set rate limit info in context', async () => {
      let rateLimitInfo: any

      app.use('*', rateLimit({ max: 5, windowMs: 60000 }))
      app.get('/', (c) => {
        rateLimitInfo = c.var.rateLimitInfo
        return c.text('OK')
      })

      await app.request('/')

      expect(rateLimitInfo).toEqual({
        limit: 5,
        remaining: 4,
        reset: expect.any(Date),
        current: 1
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent requests correctly', async () => {
      app.use('*', rateLimit({ max: 3, windowMs: 60000 }))
      app.get('/', (c) => c.text('OK'))

      // Make 5 concurrent requests
      const promises = Array(5).fill(0).map(() => app.request('/'))
      const responses = await Promise.all(promises)

      const successful = responses.filter(r => r.status === 200)
      const rateLimited = responses.filter(r => r.status === 429)

      expect(successful.length).toBe(3)
      expect(rateLimited.length).toBe(2)
    })

    it('should handle store errors gracefully', async () => {
      const faultyStore = {
        get: vi.fn().mockRejectedValue(new Error('Store error')),
        set: vi.fn().mockRejectedValue(new Error('Store error')),
        increment: vi.fn().mockRejectedValue(new Error('Store error'))
      }

      app.use('*', rateLimit({ max: 5, windowMs: 60000, store: faultyStore }))
      app.get('/', (c) => c.text('OK'))

      // Should not crash on store errors
      const res = await app.request('/')
      expect(res.status).toBe(500) // Or appropriate error handling
    })
  })
})
