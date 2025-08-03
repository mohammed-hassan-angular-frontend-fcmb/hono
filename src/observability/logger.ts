import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { StructuredLoggerOptions, LogEntry, LogLevel, Logger, LogDestination } from './types'

// Console destination for development
class ConsoleDestination implements LogDestination {
  constructor(private format: 'json' | 'text' = 'text') {}

  write(entry: LogEntry): void {
    if (this.format === 'json') {
      console.log(JSON.stringify(entry))
    } else {
      const { timestamp, level, message, correlationId, metadata } = entry
      const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : ''
      console.log(`${timestamp} [${level.toUpperCase()}] ${correlationId} ${message}${metadataStr}`)
    }
  }
}

// Cloudflare Workers destination
class CloudflareDestination implements LogDestination {
  async write(entry: LogEntry): Promise<void> {
    // Send to Cloudflare analytics or external logging service
    console.log(JSON.stringify(entry))
  }
}

class StructuredLogger implements Logger {
  constructor(
    private correlationId: string,
    private options: StructuredLoggerOptions,
    private context?: Context
  ) {}

  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(level)) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        correlationId: this.correlationId,
        metadata: this.redactFields(metadata),
        ...(this.context && this.options.includeRequestDetails && {
          method: this.context.req.method,
          path: this.context.req.path,
          userAgent: this.context.req.header('User-Agent'),
          ip: this.getClientIP(this.context)
        })
      }

      this.options.destination.write(entry)
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal']
    const currentLevelIndex = levels.indexOf(this.options.level)
    const logLevelIndex = levels.indexOf(level)
    return logLevelIndex >= currentLevelIndex
  }

  private redactFields(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata || !this.options.redactFields) return metadata

    const redacted = { ...metadata }
    for (const field of this.options.redactFields) {
      if (field in redacted) {
        redacted[field] = '[REDACTED]'
      }
    }
    return redacted
  }

  private getClientIP(context: Context): string {
    return context.req.header('CF-Connecting-IP') ||
           context.req.header('X-Forwarded-For') ||
           context.req.header('X-Real-IP') ||
           'unknown'
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata)
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata)
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata)
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata)
  }

  fatal(message: string, metadata?: Record<string, any>): void {
    this.log('fatal', message, metadata)
  }
}

function generateCorrelationId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export const structuredLogger = (options: StructuredLoggerOptions) => {
  return createMiddleware<{
    Variables: {
      logger: Logger
      correlationId: string
    }
  }>(async (c, next) => {
    const correlationId = c.req.header(options.correlationIdHeader || 'X-Correlation-ID') ||
                         generateCorrelationId()

    const logger = new StructuredLogger(correlationId, options, c)

    c.set('logger', logger)
    c.set('correlationId', correlationId)
    c.header('X-Correlation-ID', correlationId)

    const startTime = Date.now()

    logger.info('Request started', {
      method: c.req.method,
      path: c.req.path,
      userAgent: c.req.header('User-Agent')
    })

    await next()

    const duration = Date.now() - startTime
    const status = c.res?.status || 200

    logger.info('Request completed', {
      method: c.req.method,
      path: c.req.path,
      statusCode: status,
      duration: `${duration}ms`
    })
  })
}

// Convenience exports
export const consoleLogger = (level: LogLevel = 'info'): ReturnType<typeof structuredLogger> => {
  return structuredLogger({
    level,
    format: 'text',
    destination: new ConsoleDestination('text'),
    includeRequestDetails: true
  })
}

export const jsonLogger = (level: LogLevel = 'info'): ReturnType<typeof structuredLogger> => {
  return structuredLogger({
    level,
    format: 'json',
    destination: new ConsoleDestination('json'),
    includeRequestDetails: true,
    redactFields: ['password', 'token', 'authorization']
  })
}
