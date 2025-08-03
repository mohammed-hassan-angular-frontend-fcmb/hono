export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  correlationId: string
  requestId?: string
  userId?: string
  metadata?: Record<string, any>
  duration?: number
  statusCode?: number
  method?: string
  path?: string
  userAgent?: string
  ip?: string
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface StructuredLoggerOptions {
  level: LogLevel
  format: 'json' | 'text'
  correlationIdHeader?: string
  redactFields?: string[]
  destination: LogDestination
  includeRequestDetails?: boolean
}

export interface LogDestination {
  write(entry: LogEntry): void | Promise<void>
}

export interface MetricDefinition {
  name: string
  type: 'counter' | 'histogram' | 'gauge'
  description: string
  labels?: string[]
}

export interface MetricsCollectorOptions {
  namespace?: string
  exportInterval?: number
  exporters: MetricsExporter[]
  customMetrics?: MetricDefinition[]
}

export interface MetricsExporter {
  export(metrics: MetricData[]): Promise<void>
}

export interface MetricData {
  name: string
  type: string
  value: number
  labels: Record<string, string>
  timestamp: number
}

export interface TracingOptions {
  serviceName: string
  exporters: TraceExporter[]
  samplingRate?: number
  attributes?: Record<string, string>
}

export interface TraceExporter {
  export(spans: SpanData[]): Promise<void>
}

export interface SpanData {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  startTime: number
  endTime: number
  attributes: Record<string, any>
  status: { code: number; message?: string }
}

export interface HealthCheck {
  name: string
  check: () => Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>
  timeout?: number
  critical?: boolean
}

export interface HealthCheckOptions {
  endpoint?: string
  checks: HealthCheck[]
  timeout?: number
  includeSystemMetrics?: boolean
}

export interface Logger {
  debug(message: string, metadata?: Record<string, any>): void
  info(message: string, metadata?: Record<string, any>): void
  warn(message: string, metadata?: Record<string, any>): void
  error(message: string, metadata?: Record<string, any>): void
  fatal(message: string, metadata?: Record<string, any>): void
}

export interface MetricsCollector {
  counter(name: string, labels?: Record<string, string>): void
  histogram(name: string, value: number, labels?: Record<string, string>): void
  gauge(name: string, value: number, labels?: Record<string, string>): void
}

export interface Span {
  setAttributes(attributes: Record<string, any>): void
  setStatus(status: { code: number; message?: string }): void
  end(): void
}

export interface Tracer {
  startSpan(name: string, attributes?: Record<string, any>): Span
}
