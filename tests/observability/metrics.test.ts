// tests/observability/metrics.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from '../../src/hono'
import { metricsCollector } from '../../src/observability'

describe('Metrics Collector', () => {
  let app: Hono<{ Variables: { metrics: any } }>
  let mockExporter: any

  beforeEach(() => {
    app = new Hono()
    mockExporter = { export: vi.fn().mockResolvedValue(undefined) }
    vi.clearAllMocks()
  })

  describe('Request Metrics', () => {
    it('should collect basic request metrics', async () => {
      app.use('*', metricsCollector({
        namespace: 'test',
        exporters: [mockExporter],
        exportInterval: 0 // Disable automatic export
      }) as any)

      app.get('/api/users', (c) => {
        // Manually export metrics after collecting them
        const metrics = c.get('metrics')
        metrics.export()
        return c.json({ users: [] })
      })

      const res = await app.request('/api/users')
      expect(res.status).toBe(200)

      // Wait for metrics to be processed
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockExporter.export).toHaveBeenCalled()
      const exportedMetrics = mockExporter.export.mock.calls[0][0]

      expect(exportedMetrics.some((m: any) =>
        m.name === 'test_http_requests_total' &&
        m.labels.method === 'GET' &&
        m.labels.path === '/api/users'
      )).toBe(true)
    })

    it('should track response times', async () => {
      let collector: any

      app.use('*', metricsCollector({
        namespace: 'test',
        exporters: [mockExporter],
        exportInterval: 0
      }) as any)

      app.use('*', (c, next) => {
        collector = c.get('metrics')
        return next()
      })

      app.get('/', async (c) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return c.text('OK')
      })

      await app.request('/')
      await collector.export()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockExporter.export).toHaveBeenCalled()
      const exportedMetrics = mockExporter.export.mock.calls[0][0]

      expect(exportedMetrics.some((m: any) =>
        m.name === 'test_http_request_duration_ms' &&
        m.type === 'histogram' &&
        m.value >= 50
      )).toBe(true)
    })

    it('should track status codes', async () => {
      let collector: any

      app.use('*', metricsCollector({
        namespace: 'test',
        exporters: [mockExporter],
        exportInterval: 0
      }) as any)

      app.use('*', (c, next) => {
        collector = c.get('metrics')
        return next()
      })

      app.get('/success', (c) => {
        return c.text('OK')
      })
      app.get('/error', (c) => {
        return c.text('Error', 500)
      })

      await app.request('/success')
      await collector.export()
      await app.request('/error')
      await collector.export()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockExporter.export).toHaveBeenCalledTimes(2)

      const allMetrics = mockExporter.export.mock.calls.flatMap(call => call[0])

      expect(allMetrics.some((m: any) =>
        m.labels?.status_code === '200'
      )).toBe(true)

      expect(allMetrics.some((m: any) =>
        m.labels?.status_code === '500'
      )).toBe(true)
    })
  })

  describe('Custom Metrics', () => {
    it('should allow custom metrics in routes', async () => {
      let collector: any

      app.use('*', metricsCollector({
        namespace: 'hono', // Add explicit namespace
        exporters: [mockExporter],
        exportInterval: 0
      }) as any)

      app.use('*', (c, next) => {
        collector = c.get('metrics')
        return next()
      })

      app.get('/api/users', (c) => {
        const metrics = c.get('metrics')
        metrics.counter('users_fetched', { source: 'database' })
        metrics.gauge('active_connections', 15)
        metrics.histogram('query_duration', 245)

        return c.json({ users: [] })
      })

      await app.request('/api/users')
      await collector.export()
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockExporter.export).toHaveBeenCalled()
      const exportedMetrics = mockExporter.export.mock.calls[0][0]

      // Debug: log the actual metrics
      console.log('Exported metrics:', exportedMetrics.map((m: any) => ({ name: m.name, type: m.type })))

      expect(exportedMetrics.some((m: any) =>
        m.name === 'hono_users_fetched' && m.type === 'counter'
      )).toBe(true)

      expect(exportedMetrics.some((m: any) =>
        m.name === 'hono_active_connections' && m.type === 'gauge'
      )).toBe(true)
    })
  })

  describe('Export Functionality', () => {
    it('should export metrics automatically', async () => {
      app.use('*', metricsCollector({
        exporters: [mockExporter],
        exportInterval: 100 // 100ms for testing
      }) as any)

      app.get('/', (c) => c.text('OK'))

      await app.request('/')
      await new Promise(resolve => setTimeout(resolve, 150))

      expect(mockExporter.export).toHaveBeenCalled()
    })

    it('should handle exporter errors gracefully', async () => {
      const faultyExporter = {
        export: vi.fn().mockRejectedValue(new Error('Export failed'))
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      app.use('*', metricsCollector({
        exporters: [faultyExporter],
        exportInterval: 50
      }) as any)

      app.get('/', (c) => {
        // Manually trigger export to test error handling
        const metrics = c.get('metrics')
        metrics.export().catch(console.error)
        return c.text('OK')
      })

      await app.request('/')
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error))
      consoleSpy.mockRestore()
    })
  })
})
