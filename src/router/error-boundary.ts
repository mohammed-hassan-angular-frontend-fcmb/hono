/* eslint-disable @typescript-eslint/no-explicit-any */
// src/router/error-boundary.ts
import type { Context, MiddlewareHandler } from 'hono'
import type { ContentfulStatusCode } from '../utils/http-status'
import type { ErrorBoundaryHandler } from './types'

export interface ErrorBoundaryOptions {
  handler?: ErrorBoundaryHandler
  logErrors?: boolean
  includeStack?: boolean
  fallbackResponse?: {
    status: number
    message: string
  }
  onError?: (error: Error, context: Context) => void | Promise<void>
}

export interface ErrorDetails {
  name: string
  message: string
  stack?: string
  timestamp: number
  path: string
  method: string
  userAgent?: string
  ip?: string
}

/**
 * Default error boundary handler
 */
const defaultErrorHandler: ErrorBoundaryHandler = (error: Error, c: Context) => {
  const status = getErrorStatus(error)
  const message = getErrorMessage(error)

  return c.json({
    error: {
      message,
      timestamp: Date.now(),
      path: c.req.path,
      method: c.req.method
    }
  }, status as ContentfulStatusCode)
}

/**
 * Creates an error boundary middleware
 */
export function createErrorBoundary(
  handler?: ErrorBoundaryHandler,
  options: ErrorBoundaryOptions = {}
): MiddlewareHandler {
  const errorHandler = handler || options.handler || defaultErrorHandler
  const shouldLog = options.logErrors !== false
  const includeStack = options.includeStack || false

  return async (c: Context, next) => {
    try {
      await next()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      // Log error if enabled
      if (shouldLog) {
        logError(err, c, includeStack)
      }

      // Call custom error callback if provided
      if (options.onError) {
        try {
          await options.onError(err, c)
        } catch (callbackError) {
          console.error('Error in error boundary callback:', callbackError)
        }
      }

      try {
        // Call the error handler
        const response = await errorHandler(err, c)
        return response
      } catch (handlerError) {
        // If the error handler itself throws, use fallback
        console.error('Error in error boundary handler:', handlerError)
        return createFallbackResponse(c, options.fallbackResponse)
      }
    }
  }
}

/**
 * Creates multiple nested error boundaries
 */
export function createNestedErrorBoundaries(
  boundaries: Array<{
    condition?: (error: Error, context: Context) => boolean
    handler: ErrorBoundaryHandler
    options?: ErrorBoundaryOptions
  }>
): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      await next()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      // Find the first matching boundary
      for (const boundary of boundaries) {
        if (!boundary.condition || boundary.condition(err, c)) {
          try {
            const response = await boundary.handler(err, c)
            return response
          } catch (handlerError) {
            console.error('Error in nested boundary handler:', handlerError)
            continue // Try next boundary
          }
        }
      }

      // If no boundary handled the error, use default
      return defaultErrorHandler(err, c)
    }
  }
}

/**
 * Error boundary for specific error types
 */
export function createTypedErrorBoundary<T extends Error>(
  errorType: new (...args: any[]) => T,
  handler: (error: T, context: Context) => Response | Promise<Response>
): MiddlewareHandler {
  return createErrorBoundary((error, c) => {
    if (error instanceof errorType) {
      return handler(error, c)
    }
    throw error // Re-throw if not the expected type
  })
}

/**
 * Error boundary with retry logic
 */
export function createRetryErrorBoundary(
  maxRetries: number = 3,
  retryDelay: number = 1000,
  shouldRetry: (error: Error, attempt: number) => boolean = () => true
): MiddlewareHandler {
  return async (c: Context, next) => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await next()
        return // Success, no need to retry
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        lastError = err

        // Check if we should retry
        if (attempt < maxRetries && shouldRetry(err, attempt)) {
          // Wait before retrying
          if (retryDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
          continue
        }

        // Max retries reached or shouldn't retry
        break
      }
    }

    // All retries failed, throw the last error
    if (lastError) {
      throw lastError
    }
  }
}

/**
 * Circuit breaker error boundary
 */
export class CircuitBreakerErrorBoundary {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private maxFailures: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  createMiddleware(): MiddlewareHandler {
    return async (c: Context, next) => {
      if (this.state === 'OPEN') {
        if (Date.now() - this.lastFailureTime > this.timeout) {
          this.state = 'HALF_OPEN'
        } else {
          return c.json({
            error: {
              message: 'Circuit breaker is OPEN',
              timestamp: Date.now(),
              path: c.req.path
            }
          }, 503)
        }
      }

      try {
        await next()

        // Success - reset failure count if in HALF_OPEN state
        if (this.state === 'HALF_OPEN') {
          this.reset()
        }
      } catch (error) {
        this.recordFailure()
        throw error
      }
    }
  }

  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.maxFailures) {
      this.state = 'OPEN'
    }
  }

  private reset(): void {
    this.failureCount = 0
    this.lastFailureTime = 0
    this.state = 'CLOSED'
  }

  getState(): { state: string; failureCount: number; lastFailureTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    }
  }
}

/**
 * Error boundary with custom error classification
 */
export function createClassifiedErrorBoundary(
  classifiers: Array<{
    name: string
    test: (error: Error) => boolean
    handler: ErrorBoundaryHandler
    priority?: number
  }>
): MiddlewareHandler {
  // Sort by priority (higher first)
  const sortedClassifiers = classifiers.sort((a, b) => (b.priority || 0) - (a.priority || 0))

  return createErrorBoundary(async (error, c) => {
    // Find the first matching classifier
    for (const classifier of sortedClassifiers) {
      if (classifier.test(error)) {
        return classifier.handler(error, c)
      }
    }

    // No classifier matched, use default
    return defaultErrorHandler(error, c)
  })
}

/**
 * Helper functions
 */
function getErrorStatus(error: Error): number {
  // Check for common error types and their status codes
  if (error.name === 'ValidationError') return 400
  if (error.name === 'UnauthorizedError') return 401
  if (error.name === 'ForbiddenError') return 403
  if (error.name === 'NotFoundError') return 404
  if (error.name === 'ConflictError') return 409
  if (error.name === 'TooManyRequestsError') return 429

  // Check error message for common patterns
  if (error.message.toLowerCase().includes('not found')) return 404
  if (error.message.toLowerCase().includes('unauthorized')) return 401
  if (error.message.toLowerCase().includes('forbidden')) return 403
  if (error.message.toLowerCase().includes('validation')) return 400

  // Default to 500 for unknown errors
  return 500
}

function getErrorMessage(error: Error): string {
  // Sanitize error messages in production
  if (process.env.NODE_ENV === 'production') {
    const status = getErrorStatus(error)
    switch (status) {
      case 400: return 'Bad Request'
      case 401: return 'Unauthorized'
      case 403: return 'Forbidden'
      case 404: return 'Not Found'
      case 409: return 'Conflict'
      case 429: return 'Too Many Requests'
      default: return 'Internal Server Error'
    }
  }

  return error.message
}

function logError(error: Error, context: Context, includeStack: boolean = false): void {
  const errorDetails: ErrorDetails = {
    name: error.name,
    message: error.message,
    timestamp: Date.now(),
    path: context.req.path,
    method: context.req.method,
    userAgent: context.req.header('user-agent'),
    ip: context.req.header('x-forwarded-for') || context.req.header('x-real-ip')
  }

  if (includeStack) {
    errorDetails.stack = error.stack
  }

  console.error('Error boundary caught error:', errorDetails)
}

function createFallbackResponse(context: Context, fallback?: { status: number; message: string }): Response {
  const status = fallback?.status || 500
  const message = fallback?.message || 'Internal Server Error'

  return context.json({
    error: {
      message,
      timestamp: Date.now(),
      path: context.req.path
    }
  }, status as ContentfulStatusCode)
}

/**
 * Predefined error boundary configurations
 */
export const ErrorBoundaryPresets = {
  // Basic error boundary with logging
  basic: (includeStack = false) => createErrorBoundary(undefined, {
    logErrors: true,
    includeStack
  }),

  // Error boundary for API endpoints
  api: () => createErrorBoundary((error, c) => {
    const status = getErrorStatus(error)
    return c.json({
      success: false,
      error: {
        code: error.name,
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
        path: c.req.path
      }
    }, status as ContentfulStatusCode)
  }),

  // Error boundary for development with full error details
  development: () => createErrorBoundary((error, c) => {
    return c.json({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        path: c.req.path,
        method: c.req.method
      }
    }, getErrorStatus(error) as ContentfulStatusCode)
  }),

  // Error boundary with retry logic
  withRetry: (maxRetries = 3, delay = 1000) =>
    createRetryErrorBoundary(maxRetries, delay),

  // Circuit breaker error boundary
  circuitBreaker: (maxFailures = 5, timeout = 60000) =>
    new CircuitBreakerErrorBoundary(maxFailures, timeout).createMiddleware()
}
