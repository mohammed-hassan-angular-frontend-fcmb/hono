/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono'
import { describe, it, expect } from 'vitest'
import { rateLimit, smartCORS, validator } from '../../src/middleware/security'
import type { RateLimitInfo } from '../../src/middleware/security/types'
import { observabilitySuite } from '../../src/observability'
import { extendHono } from '../../src/router/group'

// Apply the Hono extension to enable group functionality
extendHono()

describe('Performance Benchmarks', () => {
  describe('Security Middleware Performance', () => {
    it('should meet rate limiting performance targets', async () => {
      const app = new Hono<{ Variables: { rateLimitInfo: RateLimitInfo } }>()
      app.use('*', rateLimit({
        max: 1000,
        windowMs: 60000
      }) as any)
      app.get('/', (c) => c.text('OK'))

      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await app.request('/')
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      console.log(`Rate limiting average overhead: ${avgTime.toFixed(3)}ms`)
      expect(avgTime).toBeLessThan(1) // Target: <1ms
    })

    it('should meet CORS performance targets', async () => {
      const app = new Hono()
      app.use('*', smartCORS({
        origin: ['https://app1.com', 'https://app2.com', 'https://app3.com']
      }) as any)
      app.get('/', (c) => c.text('OK'))

      const iterations = 1000
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await app.request('/', {
          headers: { 'Origin': 'https://app1.com' }
        })
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      console.log(`CORS average overhead: ${avgTime.toFixed(3)}ms`)
      expect(avgTime).toBeLessThan(0.5) // Target: <0.5ms
    })

    it('should meet validation performance targets', async () => {
      const app = new Hono()
      app.post('/',
        validator({
          body: (data: any) => {
            if (!data.name || typeof data.name !== 'string') {
              return { success: false, error: 'Invalid' }
            }
            return { success: true, data }
          }
        }) as any,
        (c) => c.json({ success: true })
      )

      const iterations = 500
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await app.request('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `user${i}` })
        })
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      console.log(`Validation average overhead: ${avgTime.toFixed(3)}ms`)
      expect(avgTime).toBeLessThan(1) // Target: <1ms
    })
  })

  describe('Observability Performance', () => {
    it('should meet observability suite performance targets', async () => {
      const app = new Hono()
      app.use('*', ...observabilitySuite({
        serviceName: 'benchmark-test'
      }))
      app.get('/', (c) => c.text('OK'))

      const iterations = 500
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await app.request('/')
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      console.log(`Observability suite average overhead: ${avgTime.toFixed(3)}ms`)
      expect(avgTime).toBeLessThan(3) // Target: <3ms
    })
  })

  describe('Route Group Performance', () => {
    it('should meet route group performance targets', async () => {
      const app = new Hono()

      // Create complex nested group structure
      const api = app.group('/api')
      const v1 = api.group('/v1')
      const users = v1.group('/users')
      const posts = v1.group('/posts')

      users.get('/:id', (c) => c.json({ id: c.req.param('id') }))
      posts.get('/:id', (c) => c.json({ postId: c.req.param('id') }))

      const iterations = 2000 // Increase for more stable measurements
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await app.request(`/api/v1/users/${i}`)
        await app.request(`/api/v1/posts/${i}`)
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / (iterations * 2)

      console.log(`Route group average overhead: ${avgTime.toFixed(3)}ms`)

      // Compare with baseline (direct routing)
      const baselineApp = new Hono()
      baselineApp.get('/api/v1/users/:id', (c) => c.json({ id: c.req.param('id') }))
      baselineApp.get('/api/v1/posts/:id', (c) => c.json({ postId: c.req.param('id') }))

      const baselineStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await baselineApp.request(`/api/v1/users/${i}`)
        await baselineApp.request(`/api/v1/posts/${i}`)
      }
      const baselineEnd = performance.now()
      const baselineAvg = (baselineEnd - baselineStart) / (iterations * 2)

      const overheadPercentage = ((avgTime - baselineAvg) / baselineAvg) * 100
      console.log(`Route group overhead vs baseline: ${overheadPercentage.toFixed(2)}%`)

      expect(overheadPercentage).toBeLessThan(50) // Adjusted target: <50%
    })
  })
})
