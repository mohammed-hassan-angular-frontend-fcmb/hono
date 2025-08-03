import { createMiddleware } from '../../helper/factory'
import type { SecurityHeadersOptions } from './types'

const defaultCSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"

export const securityHeaders = (options: SecurityHeadersOptions = {}) => {
  const {
    contentSecurityPolicy = defaultCSP,
    crossOriginEmbedderPolicy = 'require-corp',
    crossOriginOpenerPolicy = 'same-origin',
    crossOriginResourcePolicy = 'same-origin',
    hsts = {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: false
    },
    noSniff = true,
    frameguard = 'deny',
    xssFilter = true
  } = options

  return createMiddleware(async (c, next) => {
    await next()

    // Content Security Policy
    if (contentSecurityPolicy) {
      c.header('Content-Security-Policy', contentSecurityPolicy)
    }

    // Cross-Origin Embedder Policy
    if (crossOriginEmbedderPolicy) {
      c.header('Cross-Origin-Embedder-Policy', crossOriginEmbedderPolicy)
    }

    // Cross-Origin Opener Policy
    if (crossOriginOpenerPolicy) {
      c.header('Cross-Origin-Opener-Policy', crossOriginOpenerPolicy)
    }

    // Cross-Origin Resource Policy
    if (crossOriginResourcePolicy) {
      c.header('Cross-Origin-Resource-Policy', crossOriginResourcePolicy)
    }

    // HTTP Strict Transport Security
    if (hsts) {
      let hstsValue = `max-age=${hsts.maxAge}`
      if (hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains'
      }
      if (hsts.preload) {
        hstsValue += '; preload'
      }
      c.header('Strict-Transport-Security', hstsValue)
    }

    // X-Content-Type-Options
    if (noSniff) {
      c.header('X-Content-Type-Options', 'nosniff')
    }

    // X-Frame-Options
    if (frameguard) {
      c.header('X-Frame-Options', frameguard.toUpperCase())
    }

    // X-XSS-Protection
    if (xssFilter) {
      c.header('X-XSS-Protection', '1; mode=block')
    }

    // Additional security headers
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  })
}
