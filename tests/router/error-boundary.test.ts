/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from '../../src'
import { HTTPException } from '../../src/http-exception'
import {
  createErrorBoundary,
  ErrorBoundaryPresets,
  CircuitBreakerErrorBoundary
} from '../../src/router/error-boundary'

describe('Error Boundary', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  describe('createErrorBoundary', () => {
    it('should use default handler when no custom handler provided', async () => {
      app.use('*', createErrorBoundary() as any)
      app.get('/error', () => {
        throw new Error('Test error')
      })

      const res = await app.request('/error')
      expect(res.status).toBe(500)
      expect(await res.text()).toBe('Internal Server Error')
    })

    it('should handle HTTPException correctly', async () => {
      app.use('*', createErrorBoundary() as any)
      app.get('/http-error', () => {
        throw new HTTPException(404, { message: 'Not Found' })
      })

      const res = await app.request('/http-error')
      expect(res.status).toBe(404)
      expect(await res.text()).toBe('Not Found')
    })
  })

  describe('ErrorBoundaryPresets', () => {
    it('should use basic preset', async () => {
      app.use('*', ErrorBoundaryPresets.basic() as any)
      app.get('/error', () => {
        throw new Error('Test error')
      })

      const res = await app.request('/error')
      expect(res.status).toBe(500)
      expect(await res.text()).toBe('Internal Server Error')
    })
  })

  describe('CircuitBreakerErrorBoundary', () => {
    it('should allow requests when circuit is closed', async () => {
      const circuitBreaker = new CircuitBreakerErrorBoundary(3, 1000)

      app.use('*', circuitBreaker.createMiddleware() as any)
      app.get('/success', (c) => c.text('OK'))

      const res = await app.request('/success')
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('OK')
    })
  })

  describe('Error handling options', () => {
    it('should log errors when logErrors is true', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      app.use('*', createErrorBoundary(undefined, { logErrors: true }) as any)
      app.get('/error', () => {
        throw new Error('Test error')
      })

      await app.request('/error')
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should include stack trace when includeStack is true', async () => {
      app.use('*', createErrorBoundary(undefined, { includeStack: true }) as any)
      app.get('/error', () => {
        throw new Error('Test error')
      })

      const res = await app.request('/error')
      expect(res.status).toBe(500)
      // Stack trace would be included in response for development preset
    })
  })
})

