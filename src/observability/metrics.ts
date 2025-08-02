// src/observability/metrics.ts
import { createMiddleware } from "../helper/factory";

interface MetricsCollector {
  namespace?: string;
  exportInterval?: number;
  exporters: MetricsExporter[];
  customMetrics?: MetricDefinition[];
}

interface MetricsExporter {
  type: 'prometheus' | 'opentelemetry' | 'custom';
  endpoint?: string;
  export(metrics: any): Promise<void> | void;
}

interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description?: string;
  labels?: string[];
}

export const metricsCollector = (options: MetricsCollector) =>
  createMiddleware<{ Variables: { metrics: MetricsCollector } }>((c, next) => {
    c.set('metrics', options);
    return next();
  });
