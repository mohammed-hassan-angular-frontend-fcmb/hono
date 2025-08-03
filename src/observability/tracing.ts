/* eslint-disable @typescript-eslint/no-explicit-any */

import { createMiddleware } from '../helper/factory'
import type { TracingOptions, TraceExporter, SpanData, Span, Tracer } from './types'

class SimpleSpan implements Span {
  private attributes: Record<string, any> = {}
  private status = { code: 0 }
  private endTime?: number

  constructor(
    public traceId: string,
    public spanId: string,
    public name: string,
    public parentSpanId?: string,
    public startTime: number = Date.now(),
    private onEnd?: (span: SpanData) => void
  ) {}

  setAttributes(attributes: Record<string, any>): void {
    Object.assign(this.attributes, attributes)
  }

  setStatus(status: { code: number; message?: string }): void {
    this.status = status
  }

  end(): void {
    this.endTime = Date.now()

    if (this.onEnd) {
      this.onEnd({
        traceId: this.traceId,
        spanId: this.spanId,
        parentSpanId: this.parentSpanId,
        name: this.name,
        startTime: this.startTime,
        endTime: this.endTime,
        attributes: this.attributes,
        status: this.status
      })
    }
  }
}

class SimpleTracer implements Tracer {
  private spans: SpanData[] = []

  constructor(
    private traceId: string,
    private exporters: TraceExporter[]
  ) {}

  startSpan(name: string, attributes: Record<string, any> = {}): Span {
    const spanId = this.generateSpanId()
    const span = new SimpleSpan(
      this.traceId,
      spanId,
      name,
      undefined,
      Date.now(),
      (spanData) => {
        this.spans.push(spanData)
      }
    )

    span.setAttributes(attributes)
    return span
  }

  private generateSpanId(): string {
    return Math.random().toString(16).substring(2)
  }

  async export(): Promise<void> {
    if (this.spans.length > 0) {
      await Promise.all(this.exporters.map(exporter => exporter.export([...this.spans])))
      this.spans = []
    }
  }
}

// Console exporter for development
class ConsoleTraceExporter implements TraceExporter {
  async export(spans: SpanData[]): Promise<void> {
    console.log('=== Trace Export ===')
    spans.forEach(span => {
      const duration = span.endTime - span.startTime
      console.log(`Span: ${span.name} [${span.spanId}] ${duration}ms`)
      if (Object.keys(span.attributes).length > 0) {
        console.log(`  Attributes:`, span.attributes)
      }
    })
    console.log('===================')
  }
}

function generateTraceId(): string {
  return Math.random().toString(16).substring(2) + Date.now().toString(16)
}

export const tracing = (options: TracingOptions) => {
  const {
    serviceName,
    exporters = [new ConsoleTraceExporter()],
    samplingRate = 1.0,
    attributes = {}
  } = options

  return createMiddleware<{
    Variables: {
      span: Span
      tracer: Tracer
    }
  }>(async (c, next) => {
    // Check sampling rate
    if (Math.random() > samplingRate) {
      await next()
      return
    }

    const traceId = c.req.header('X-Trace-ID') || generateTraceId()
    const tracer = new SimpleTracer(traceId, exporters)

    const span = tracer.startSpan(`${c.req.method} ${c.req.path}`, {
      'service.name': serviceName,
      'http.method': c.req.method,
      'http.url': c.req.url,
      'http.user_agent': c.req.header('User-Agent'),
      ...attributes
    })

    c.set('span', span)
    c.set('tracer', tracer)
    c.header('X-Trace-ID', traceId)

    try {
      await next()

      const status = c.res?.status || 200
      span.setAttributes({
        'http.status_code': status
      })

      if (status >= 400) {
        span.setStatus({ code: 2, message: 'HTTP Error' }) // Error status
      } else {
        span.setStatus({ code: 1 }) // OK status
      }
    } catch (error) {
      span.setStatus({
        code: 2,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      span.setAttributes({
        'error': true,
        'error.message': error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    } finally {
      span.end()
      await (tracer as SimpleTracer).export()
    }
  })
}
