// src/observability/tracing.ts
import type { Span, Tracer } from '@opentelemetry/api';
import { createMiddleware } from "../helper/factory";

interface TraceExporter {
  type: 'jaeger' | 'zipkin' | 'opentelemetry' | 'custom';
  endpoint?: string;
  export(spans: any): Promise<void> | void;
}

interface TracingOptions {
  serviceName: string;
  exporters: TraceExporter[];
  samplingRate?: number;
  attributes?: Record<string, string>;
}

export const tracing = (options: TracingOptions) =>
  createMiddleware<{ Variables: { span: Span; tracer: Tracer } }>

