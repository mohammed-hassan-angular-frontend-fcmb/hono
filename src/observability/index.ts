export { structuredLogger, consoleLogger, jsonLogger } from './logger'
export { metricsCollector } from './metrics'
export { tracing } from './tracing'
export { healthCheck, databaseHealthCheck, externalServiceHealthCheck } from './health'

export type {
  LogEntry,
  LogLevel,
  StructuredLoggerOptions,
  LogDestination,
  MetricDefinition,
  MetricsCollectorOptions,
  MetricsExporter,
  MetricData,
  TracingOptions,
  TraceExporter,
  SpanData,
  HealthCheck,
  HealthCheckOptions,
  Logger,
  MetricsCollector,
  Span,
  Tracer
} from './types'

// Convenience function for full observability setup
import type { MiddlewareHandler } from 'hono'
import { structuredLogger } from './logger'
import { metricsCollector } from './metrics'
import { tracing } from './tracing'

export interface ObservabilitySuiteOptions {
  serviceName: string
  logger?: Parameters<typeof structuredLogger>[0]
  metrics?: Parameters<typeof metricsCollector>[0]
  tracing?: Omit<Parameters<typeof tracing>[0], 'serviceName'>
}

export const observabilitySuite = (options: ObservabilitySuiteOptions): MiddlewareHandler[] => {
  const middleware: MiddlewareHandler[] = []

  // Logger first to capture all requests
  if (options.logger) {
    middleware.push(structuredLogger(options.logger || {
      level: 'info',
      format: 'json',
      destination: { write: (entry) => console.log(JSON.stringify(entry)) },
      includeRequestDetails: true
    }))
  }

  // Metrics collection
  if (options.metrics) {
    middleware.push(metricsCollector(options.metrics || {}))
  }

  // Distributed tracing
  if (options.tracing) {
    middleware.push(tracing({
      serviceName: options.serviceName,
      ...options.tracing
    }))
  }

  return middleware
}
