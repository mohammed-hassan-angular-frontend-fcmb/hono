// src/middleware/security/rate-limit.ts

import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { RateLimitOptions, RateLimitStore, RateLimitInfo } from './types'


class MemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>()

  async get(key: string): Promise<number | null> {
    const entry = this.store.get(key)
    if (!entry || Date.now() > entry.resetTime) {
      this.store.delete(key)
      return null
    }
    return entry.count
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    this.store.set(key, {
      count: value,
      resetTime: Date.now() + ttl
    })
  }

  async increment(key: string, ttl: number): Promise<number> {
    const current = await this.get(key)
    const newCount = (current || 0) + 1
    await this.set(key, newCount, ttl)
    return newCount
  }
}

// Runtime-specific stores
class CloudflareKVStore implements RateLimitStore {
  constructor(private kv: any) {}

  async get(key: string): Promise<number | null> {
    const value = await this.kv.get(`rate_limit:${key}`)
    return value ? parseInt(value) : null
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    await this.kv.put(`rate_limit:${key}`, value.toString(), {
      expirationTtl: Math.floor(ttl / 1000)
    })
  }

  async increment(key: string, ttl: number): Promise<number> {
    const current = await this.get(key) || 0
    const newCount = current + 1
    await this.set(key, newCount, ttl)
    return newCount
  }
}

const defaultKeyGenerator = (c: Context): string => {
  // Try different sources for client identification
  return c.req.header('x-forwarded-for') ||
         c.req.header('x-real-ip') ||
         c.req.header('cf-connecting-ip') ||
         'unknown'
}

export const rateLimit = (options: RateLimitOptions) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    keyGenerator = defaultKeyGenerator,
    store = new MemoryStore(),
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    onLimitReached
  } = options

  return createMiddleware<{
    Variables: {
      rateLimitInfo: RateLimitInfo
    }
  }>(async (c, next) => {
    const key = keyGenerator(c)
    const current = await store.increment(key, windowMs)
    const resetTime = new Date(Date.now() + windowMs)

    const rateLimitInfo: RateLimitInfo = {
      limit: max,
      remaining: Math.max(0, max - current),
      reset: resetTime,
      current
    }

    c.set('rateLimitInfo', rateLimitInfo)

    // Set rate limit headers
    c.header('X-RateLimit-Limit', max.toString())
    c.header('X-RateLimit-Remaining', rateLimitInfo.remaining.toString())
    c.header('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000).toString())

    if (current > max) {
      if (onLimitReached) {
        return onLimitReached(c)
      }

      c.header('Retry-After', Math.ceil(windowMs / 1000).toString())
      return c.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`
        },
        429
      )
    }

    await next()

    // Handle skip options
    const response = c.res
    if (skipFailedRequests && response && response.status >= 400) {
      // Decrement counter for failed requests if skipFailedRequests is true
      const newCount = Math.max(0, current - 1)
      await store.set(key, newCount, windowMs)
    }

    if (skipSuccessfulRequests && response && response.status < 400) {
      // Decrement counter for successful requests if skipSuccessfulRequests is true
      const newCount = Math.max(0, current - 1)
      await store.set(key, newCount, windowMs)
    }
  })
}

// Helper for creating Cloudflare KV store
export const createCloudflareKVStore = (kv: any): RateLimitStore => {
  return new CloudflareKVStore(kv)
}
