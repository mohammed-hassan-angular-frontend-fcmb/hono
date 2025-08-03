import type { Context, MiddlewareHandler } from 'hono'

export interface RateLimitStore {
  get(key: string): Promise<number | null>
  set(key: string, value: number, ttl: number): Promise<void>
  increment(key: string, ttl: number): Promise<number>
}

export interface RateLimitOptions {
  windowMs: number
  max: number
  keyGenerator?: (c: Context) => string
  store?: RateLimitStore
  skipFailedRequests?: boolean
  skipSuccessfulRequests?: boolean
  onLimitReached?: (c: Context) => Response | Promise<Response>
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
  current: number
}

export interface SmartCORSOptions {
  origin?: string | string[] | ((origin: string, c: Context) => boolean | Promise<boolean>)
  credentials?: boolean
  allowedMethods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  maxAge?: number
  preflightContinue?: boolean
}

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: string | false
  crossOriginEmbedderPolicy?: string | false
  crossOriginOpenerPolicy?: string | false
  crossOriginResourcePolicy?: string | false
  hsts?: {
    maxAge?: number
    includeSubDomains?: boolean
    preload?: boolean
  } | false
  noSniff?: boolean
  frameguard?: 'deny' | 'sameorigin' | false
  xssFilter?: boolean
}

export interface ValidationSchema {
  body?: (data: any) => { success: boolean; data?: any; error?: string }
  params?: (data: any) => { success: boolean; data?: any; error?: string }
  query?: (data: any) => { success: boolean; data?: any; error?: string }
  headers?: (data: any) => { success: boolean; data?: any; error?: string }
}

export type InferValidated<T extends ValidationSchema> = {
  [K in keyof T]: T[K] extends (data: any) => { data?: infer R } ? R : never
}
