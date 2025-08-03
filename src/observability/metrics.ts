import { createMiddleware } from 'hono/factory'
import type { MetricsCollectorOptions, MetricsExporter, MetricData, MetricsCollector } from './types'

class SimpleMetricsCollector implements MetricsCollector {
  private metrics = new Map<string, MetricData>()
  private counters = new Map<string, number>()
  private histograms = new Map<string, number[]>()
  private gauges = new Map<string, number>()

  constructor(
    private namespace: string = '',
    private exporters: MetricsExporter[] = []
  ) {}

  counter(name: string, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels)
    const current = this.counters.get(key) || 0
    this.counters.set(key, current + 1)

    this.updateMetric(name, 'counter', current + 1, labels)
  }

  histogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels)
    const values = this.histograms.get(key) || []
    values.push(value)
    this.histograms.set(key, values)

    // For simplicity, store the latest value. In production, you'd calculate percentiles
    this.updateMetric(name, 'histogram', value, labels)
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels)
    this.gauges.set(key, value)

    this.updateMetric(name, 'gauge', value, labels)
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    return `${name}{${labelStr}}`
  }

  private updateMetric(name: string, type: string, value: number, labels: Record<string, string>): void {
    const fullName = this.namespace ? `${this.namespace}_${name}` : name
    this.metrics.set(this.getMetricKey(fullName, labels), {
      name: fullName,
      type,
      value,
      labels,
      timestamp: Date.now()
    })
  }

  async export(): Promise<void> {
    const metrics = Array.from(this.metrics.values())
    await Promise.all(this.exporters.map(exporter => exporter.export(metrics)))
  }

  getMetrics(): MetricData[] {
    return Array.from(this.metrics.values())
  }
}

// Console exporter for development
class ConsoleMetricsExporter implements MetricsExporter {
  async export(metrics: MetricData[]): Promise<void> {
    console.log('=== Metrics Export ===')
    metrics.forEach(metric => {
      const labels = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      console.log(`${metric.name}{${labels}} ${metric.value} (${metric.type})`)
    })
    console.log('=====================')
  }
}

export const metricsCollector = (options: MetricsCollectorOptions) => {
  const {
    namespace = 'hono',
    exportInterval = 60000, // 1 minute
    exporters = [new ConsoleMetricsExporter()],
    customMetrics = []
  } = options

  const collector = new SimpleMetricsCollector(namespace, exporters)

  // Setup automatic export interval
  let exportTimer: any
  if (exportInterval > 0) {
    exportTimer = setInterval(() => {
      collector.export().catch(console.error)
    }, exportInterval)
  }

  return createMiddleware<{
    Variables: {
      metrics: MetricsCollector
    }
  }>(async (c, next) => {
    c.set('metrics', collector)

    const startTime = Date.now()

    // Track request metrics
    collector.counter('http_requests_total', {
      method: c.req.method,
      path: c.req.path
    })

    await next()

    const duration = Date.now() - startTime
    const status = c.res?.status || 200

    // Track response metrics
    collector.histogram('http_request_duration_ms', duration, {
      method: c.req.method,
      path: c.req.path,
      status_code: status.toString()
    })

    collector.counter('http_responses_total', {
      method: c.req.method,
      path: c.req.path,
      status_code: status.toString()
    })
  })
}
