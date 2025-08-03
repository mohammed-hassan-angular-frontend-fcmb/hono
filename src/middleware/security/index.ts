export { rateLimit, createCloudflareKVStore } from './rate-limit'
export { smartCORS } from './cors'
export { validator, createStringValidator, createNumberValidator } from './validator'
export { securityHeaders } from './security-headers'

export type {
  RateLimitOptions,
  RateLimitStore,
  RateLimitInfo,
  SmartCORSOptions,
  SecurityHeadersOptions,
  ValidationSchema,
  InferValidated
} from './types'

// Convenience function for applying all security middleware
import type { MiddlewareHandler } from 'hono'
import { smartCORS } from './cors'
import { rateLimit } from './rate-limit'
import { securityHeaders } from './security-headers'

export interface SecuritySuiteOptions {
  rateLimit?: Parameters<typeof rateLimit>[0]
  cors?: Parameters<typeof smartCORS>[0]
  securityHeaders?: Parameters<typeof securityHeaders>[0]
}

export const securitySuite = (options: SecuritySuiteOptions = {}): MiddlewareHandler[] => {
  const middleware: MiddlewareHandler[] = []

  if (options.cors) {
    middleware.push(smartCORS(options.cors))
  }

  if (options.rateLimit) {
    middleware.push(rateLimit(options.rateLimit || {}))
  }

  if (options.securityHeaders) {
    middleware.push(securityHeaders(options.securityHeaders))
  }

  return middleware
}
