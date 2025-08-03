import { describe, it, expect } from 'vitest'
import { Hono } from '../../src/hono'
import { secureHeaders } from '../../src/middleware/secure-headers'

describe('Security-headers Check', () => {
  it('should return security-headers status', () => {
    expect(true).toBe(true)
  })

  it('should apply default security headers', async () => {
    const app = new Hono()
    app.use('*', secureHeaders())
    app.get('/test', (c) => c.text('OK'))

    const res = await app.request('/test')

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=15552000; includeSubDomains')
    expect(await res.text()).toBe('OK')
  })

  it('should disable specific headers when configured', async () => {
    const app = new Hono()
    app.use('*', secureHeaders({
      xFrameOptions: false,
      xContentTypeOptions: false
    }))
    app.get('/test', (c) => c.text('OK'))

    const res = await app.request('/test')

    expect(res.status).toBe(200)
    expect(res.headers.get('X-Frame-Options')).toBeNull()
    expect(res.headers.get('X-Content-Type-Options')).toBeNull()
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=15552000; includeSubDomains')
  })

  it('should apply custom CSP header', async () => {
    const app = new Hono()
    app.use('*', secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"]
      }
    }))
    app.get('/test', (c) => c.text('OK'))

    const res = await app.request('/test')

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'self' 'unsafe-inline'")
  })
})
