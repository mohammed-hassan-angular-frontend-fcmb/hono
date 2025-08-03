// tests/security/cors.test.ts
import { Hono } from 'hono'
import { describe, it, expect, beforeEach } from 'vitest'
import { smartCORS } from '../../src/middleware/security'

describe('CORS Middleware', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  describe('Basic CORS', () => {
    it('should set default CORS headers', async () => {
      app.use('*', smartCORS())
      app.get('/', (c) => c.text('OK'))

      const res = await app.request('/')

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.status).toBe(200)
    })

    it('should handle preflight requests', async () => {
      app.use('*', smartCORS({
        allowedMethods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }))

      const res = await app.request('/', { method: 'OPTIONS' })

      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST')
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
    })
  })

  describe('Origin Validation', () => {
    it('should validate string origins', async () => {
      app.use('*', smartCORS({ origin: 'https://example.com' }))
      app.get('/', (c) => c.text('OK'))

      const res = await app.request('/', {
        headers: { 'Origin': 'https://example.com' }
      })

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    })

    it('should validate array origins', async () => {
      app.use('*', smartCORS({
        origin: ['https://app1.com', 'https://app2.com']
      }))
      app.get('/', (c) => c.text('OK'))

      const validRes = await app.request('/', {
        headers: { 'Origin': 'https://app1.com' }
      })
      expect(validRes.headers.get('Access-Control-Allow-Origin')).toBe('https://app1.com')

      const invalidRes = await app.request('/', {
        headers: { 'Origin': 'https://malicious.com' }
      })
      expect(invalidRes.headers.get('Access-Control-Allow-Origin')).toBe('false')
    })

    it('should validate function origins', async () => {
      app.use('*', smartCORS({
        origin: (origin, c) => origin.endsWith('.trusted.com')
      }))
      app.get('/', (c) => c.text('OK'))

      const validRes = await app.request('/', {
        headers: { 'Origin': 'https://api.trusted.com' }
      })
      expect(validRes.headers.get('Access-Control-Allow-Origin')).toBe('https://api.trusted.com')

      const invalidRes = await app.request('/', {
        headers: { 'Origin': 'https://evil.com' }
      })
      expect(invalidRes.headers.get('Access-Control-Allow-Origin')).toBe('false')
    })
  })

  describe('Credentials and Headers', () => {
    it('should handle credentials', async () => {
      app.use('*', smartCORS({
        credentials: true,
        origin: 'https://app.com'
      }))
      app.get('/', (c) => c.text('OK'))

      const res = await app.request('/', {
        headers: { 'Origin': 'https://app.com' }
      })

      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    })

    it('should expose custom headers', async () => {
      app.use('*', smartCORS({
        exposedHeaders: ['X-Custom-Header', 'X-Total-Count']
      }))
      app.get('/', (c) => c.text('OK'))

      const res = await app.request('/')

      expect(res.headers.get('Access-Control-Expose-Headers')).toBe('X-Custom-Header, X-Total-Count')
    })
  })
})
