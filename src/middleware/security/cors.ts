// // src/middleware/security/cors.ts

import { createMiddleware } from 'hono/factory'
import type { SmartCORSOptions } from './types'

const defaultAllowedMethods = ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH']
const defaultAllowedHeaders = [
  'Origin',
  'Content-Type',
  'Accept',
  'Authorization',
  'X-Requested-With'
]

export const smartCORS = (options: SmartCORSOptions = {}) => {
  const {
    origin = '*',
    credentials = false,
    allowedMethods = defaultAllowedMethods,
    allowedHeaders = defaultAllowedHeaders,
    exposedHeaders = [],
    maxAge = 86400, // 24 hours
    preflightContinue = false
  } = options

  return createMiddleware(async (c, next) => {
    const requestOrigin = c.req.header('Origin')
    const method = c.req.method

    // Handle origin validation
    let allowedOrigin = '*'
    if (typeof origin === 'string') {
      allowedOrigin = origin
    } else if (Array.isArray(origin)) {
      if (requestOrigin && origin.includes(requestOrigin)) {
        allowedOrigin = requestOrigin
      } else {
        allowedOrigin = 'false'
      }
    } else if (typeof origin === 'function') {
      if (requestOrigin) {
        const isAllowed = await origin(requestOrigin, c)
        allowedOrigin = isAllowed ? requestOrigin : 'false'
      } else {
        allowedOrigin = 'false'
      }
    }

    // Set CORS headers
    if (allowedOrigin !== 'false') {
      c.header('Access-Control-Allow-Origin', allowedOrigin)
    }

    if (credentials) {
      c.header('Access-Control-Allow-Credentials', 'true')
    }

    if (exposedHeaders.length > 0) {
      c.header('Access-Control-Expose-Headers', exposedHeaders.join(', '))
    }

    // Handle preflight requests
    if (method === 'OPTIONS') {
      c.header('Access-Control-Allow-Methods', allowedMethods.join(', '))
      c.header('Access-Control-Allow-Headers', allowedHeaders.join(', '))
      c.header('Access-Control-Max-Age', maxAge.toString())

      if (!preflightContinue) {
        return c.body(null, 204)
      }
    }

    await next()
  })
}
