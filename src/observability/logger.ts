// src/observability/logger.ts
import type { LogLevel } from "esbuild";
import { createMiddleware } from "../helper/factory";


interface LogDestination {
  write(message: string): void | Promise<void>;
}

interface StructuredLoggerOptions {
  level: LogLevel;
  format: 'json' | 'text';
  correlationIdHeader?: string;
  redactFields?: string[];
  destination: LogDestination;
}

interface Logger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

export const structuredLogger = (options: StructuredLoggerOptions) =>
  createMiddleware<{ Variables: { logger: Logger; correlationId: string } }>
