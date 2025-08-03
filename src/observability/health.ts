import type { Hono } from 'hono'
import type { HealthCheckOptions, HealthCheck } from './types'

interface SystemMetrics {
  timestamp: string
  uptime: number
  memory?: {
    used: number
    total: number
  }
  runtime: string
}

async function getSystemMetrics(): Promise<SystemMetrics> {
  const metrics: SystemMetrics = {
    timestamp: new Date().toISOString(),
    uptime: Date.now() - (globalThis as any).__startTime || 0,
    runtime: 'unknown'
  }

  // Detect runtime environment
  if (typeof Deno !== 'undefined') {
    metrics.runtime = 'deno'
    metrics.memory = {
      used: (Deno.memoryUsage() as any).heapUsed,
      total: (Deno.memoryUsage() as any).heapTotal
    }
  } else if (typeof process !== 'undefined') {
    metrics.runtime = 'node'
    const memUsage = process.memoryUsage()
    metrics.memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal
    }
  } else if (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers')) {
    metrics.runtime = 'cloudflare-workers'
  } else if (typeof (globalThis as any).Bun !== 'undefined') {
    metrics.runtime = 'bun'
  }

  return metrics
}

export const healthCheck = (options: HealthCheckOptions) => {
  const {
    endpoint = '/health',
    checks,
    timeout = 5000,
    includeSystemMetrics = true
  } = options

  return (app: Hono) => {
    app.get(endpoint, async (c) => {
      const startTime = Date.now()
      const results: any = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {}
      }

      if (includeSystemMetrics) {
        results.system = await getSystemMetrics()
      }

      // Run health checks
      const checkPromises = checks.map(async (check) => {
        try {
          const checkTimeout = check.timeout || timeout
          const result = await Promise.race([
            check.check(),
            new Promise<{ status: 'unhealthy'; details: any }>((_, reject) =>
              setTimeout(() => reject(new Error('Health check timeout')), checkTimeout)
            )
          ])

          results.checks[check.name] = {
            status: result.status,
            details: result.details,
            critical: check.critical || false
          }

          // If critical check fails, mark overall status as unhealthy
          if (check.critical && result.status === 'unhealthy') {
            results.status = 'unhealthy'
          }
        } catch (error) {
          results.checks[check.name] = {
            status: 'unhealthy',
            details: error instanceof Error ? error.message : 'Unknown error',
            critical: check.critical || false
          }

          if (check.critical) {
            results.status = 'unhealthy'
          }
        }
      })

      await Promise.all(checkPromises)

      results.duration = `${Date.now() - startTime}ms`

      const statusCode = results.status === 'healthy' ? 200 : 503
      return c.json(results, statusCode)
    })

    // Add a simple liveness check
    app.get(`${endpoint}/live`, (c) => {
      return c.json({ status: 'alive', timestamp: new Date().toISOString() })
    })

    // Add a readiness check
    app.get(`${endpoint}/ready`, async (c) => {
      // Run only non-critical checks for readiness
      const readinessChecks = checks.filter(check => !check.critical)

      if (readinessChecks.length === 0) {
        return c.json({ status: 'ready', timestamp: new Date().toISOString() })
      }

      const results = await Promise.all(
        readinessChecks.map(async (check) => {
          try {
            const result = await check.check()
            return { name: check.name, status: result.status }
          } catch {
            return { name: check.name, status: 'unhealthy' }
          }
        })
      )

      const allReady = results.every(r => r.status === 'healthy')

      return c.json({
        status: allReady ? 'ready' : 'not ready',
        timestamp: new Date().toISOString(),
        checks: results
      }, allReady ? 200 : 503)
    })
  }
}

// Common health check implementations
export const databaseHealthCheck = (checkDatabase: () => Promise<boolean>): HealthCheck => ({
  name: 'database',
  critical: true,
  async check() {
    try {
      const isHealthy = await checkDatabase()
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: isHealthy ? 'Database connection successful' : 'Database connection failed'
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Database check failed'
      }
    }
  }
})

export const externalServiceHealthCheck = (
  serviceName: string,
  checkService: () => Promise<boolean>
): HealthCheck => ({
  name: serviceName,
  critical: false,
  async check() {
    try {
      const isHealthy = await checkService()
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: isHealthy ? `${serviceName} is responding` : `${serviceName} is not responding`
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : `${serviceName} check failed`
      }
    }
  }
})
