import type { MiddlewareHandler, Handler, Context } from 'hono'
import type { RouteGroup } from './group'

export interface RouteMetadata {
  tags?: string[]
  description?: string
  deprecated?: boolean
  auth?: boolean | string[]
  rateLimit?: {
    requests: number
    window: number
  }
  cache?: {
    ttl: number
    key?: string
  }
  [key: string]: any
}

export interface RouteInfo {
  method: string
  path: string
  metadata: RouteMetadata
  handlers: Handler[]
}

export interface ErrorBoundaryHandler {
  (error: Error, c: Context): Response | Promise<Response>
}

export interface RouteGroupOptions {
  basePath?: string
  middleware?: MiddlewareHandler[]
  errorBoundary?: ErrorBoundaryHandler
  metadata?: RouteMetadata
  inheritMiddleware?: boolean
}

export interface ConditionalMiddleware {
  condition: (route: RouteInfo) => boolean
  middleware: MiddlewareHandler[]
}

export interface RouteGroupConfig {
  basePath: string
  middleware: MiddlewareHandler[]
  errorBoundary?: ErrorBoundaryHandler
  metadata: RouteMetadata
  inheritMiddleware: boolean
  conditionalMiddleware: ConditionalMiddleware[]
  routes: RouteInfo[]
  subGroups: RouteGroup[]
}
