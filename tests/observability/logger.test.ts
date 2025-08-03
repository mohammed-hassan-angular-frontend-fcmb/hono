// tests/observability/logger.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from '../../src/hono'
import { structuredLogger } from '../../src/observability'

describe('Structured Logger', () => {
  let app: Hono

  let mockDestination: any

  beforeEach(() => {
    app = new Hono()
    mockDestination = { write: vi.fn() }
    vi.clearAllMocks()
  })

  describe('Basic Logging', () => {
    it('should create logger with correlation ID', async () => {
      app.use('*', structuredLogger({
        level: 'info',
        format: 'json',
        destination: mockDestination,
        includeRequestDetails: true
      }))

      app.get('/', (c) => {
        const logger = (c.var as any).logger
        const correlationId = (c.var as any).correlationId


        expect(logger).toBeDefined()
        expect(correlationId).toBeDefined()
        expect(typeof correlationId).toBe('string')

        return c.text('OK')
      })

      const res = await app.request('/')
      expect(res.headers.get('X-Correlation-ID')).toBeTruthy()
      expect(mockDestination.write).toHaveBeenCalledTimes(2) // Start and end logs
    })

    it('should respect log levels', async () => {
      app.use('*', structuredLogger({
        level: 'warn',
        format: 'json',
        destination: mockDestination
      }))

      app.get('/', (c) => {
        const logger = (c.var as any).logger
        logger.debug('Debug message') // Should not log
        logger.info('Info message')   // Should not log
        logger.warn('Warning message') // Should log
        logger.error('Error message') // Should log

        return c.text('OK')
      })

      await app.request('/')

      // Should have called write for: warn, error + request start/end (if >= warn level)
      const logCalls = mockDestination.write.mock.calls
      const logLevels = logCalls.map(call => call[0].level)

      expect(logLevels).not.toContain('debug')
      expect(logLevels).not.toContain('info')
      expect(logLevels).toContain('warn')
      expect(logLevels).toContain('error')
    })

    it('should redact sensitive fields', async () => {
      app.use('*', structuredLogger({
        level: 'info',
        format: 'json',
        destination: mockDestination,
        redactFields: ['password', 'token']
      }))

      app.get('/', (c) => {
        const logger = (c.var as any).logger
        logger.info('User login', {
          username: 'john',
          password: 'secret123',
          token: 'abc123'
        })

        return c.text('OK')
      })

      await app.request('/')

      const sensitiveLog = mockDestination.write.mock.calls.find(
        call => call[0].message === 'User login'
      )

      expect(sensitiveLog[0].metadata.password).toBe('[REDACTED]')
      expect(sensitiveLog[0].metadata.token).toBe('[REDACTED]')
      expect(sensitiveLog[0].metadata.username).toBe('john')
    })
  })

  describe('Request Context Integration', () => {
    it('should include request details when enabled', async () => {
      app.use('*', structuredLogger({
        level: 'info',
        format: 'json',
        destination: mockDestination,
        includeRequestDetails: true
      }))

      app.post('/api/users', (c) => c.text('Created'))

      await app.request('/api/users', {
        method: 'POST',
        headers: {
          'User-Agent': 'Test Agent',
          'X-Forwarded-For': '192.168.1.1'
        }
      })

      const requestLog = mockDestination.write.mock.calls.find(
        call => call[0].message === 'Request started'
      )

      expect(requestLog[0].method).toBe('POST')
      expect(requestLog[0].path).toBe('/api/users')
      expect(requestLog[0].userAgent).toBe('Test Agent')
      expect(requestLog[0].ip).toBe('192.168.1.1')
    })

    it('should use custom correlation ID from header', async () => {
      app.use('*', structuredLogger({
        level: 'info',
        format: 'json',
        destination: mockDestination,
        correlationIdHeader: 'X-Request-ID'
      }))

      app.get('/', (c) => c.text('OK'))

      const res = await app.request('/', {
        headers: { 'X-Request-ID': 'custom-123' }
      })

      expect(res.headers.get('X-Correlation-ID')).toBe('custom-123')
    })
  })

  describe('Performance Logging', () => {
    it('should log request duration', async () => {
      app.use('*', structuredLogger({
        level: 'info',
        format: 'json',
        destination: mockDestination
      }))

      app.get('/', async (c) => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return c.text('OK')
      })

      await app.request('/')

      const completedLog = mockDestination.write.mock.calls.find(
        call => call[0].message === 'Request completed'
      )

      expect(completedLog).toBeDefined()
      expect(completedLog[0].metadata.duration).toMatch(/^\d+ms$/)
      expect(parseInt(completedLog[0].metadata.duration)).toBeGreaterThan(90)
    })
  })
})
