// src/router/group.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { MiddlewareHandler, Handler} from 'hono';
import { Hono } from 'hono'
import { createErrorBoundary } from './error-boundary';
import { mergeMetadata, matchesCondition } from './metadata';
import type {
  RouteGroupOptions,
  RouteGroupConfig,
  RouteInfo,
  RouteMetadata,
  ErrorBoundaryHandler
} from './types'

export class RouteGroup {
  private config: RouteGroupConfig
  private app: Hono
  private parentGroup?: RouteGroup

  constructor(options: RouteGroupOptions = {}) {
    this.config = {
      basePath: options.basePath || '',
      middleware: options.middleware || [],
      errorBoundary: options.errorBoundary,
      metadata: options.metadata || {},
      inheritMiddleware: options.inheritMiddleware !== false,
      conditionalMiddleware: [],
      routes: [],
      subGroups: []
    }
    this.app = new Hono()
    this.setupMiddleware()
  }

  private setupMiddleware(): void {
    // Apply inherited middleware first
    if (this.config.inheritMiddleware && this.parentGroup) {
      const inheritedMiddleware = this.parentGroup.getInheritedMiddleware()
      inheritedMiddleware.forEach(mw => this.app.use(mw))
    }

    // Apply group-specific middleware
    this.config.middleware.forEach(mw => this.app.use(mw))

    // Apply error boundary if specified
    if (this.config.errorBoundary) {
      this.app.use(createErrorBoundary(this.config.errorBoundary))
    }
  }

  private getInheritedMiddleware(): MiddlewareHandler[] {
    const middleware: MiddlewareHandler[] = []

    if (this.parentGroup && this.config.inheritMiddleware) {
      middleware.push(...this.parentGroup.getInheritedMiddleware())
    }

    middleware.push(...this.config.middleware)
    return middleware
  }

  private applyConditionalMiddleware(route: RouteInfo): MiddlewareHandler[] {
    const applicableMiddleware: MiddlewareHandler[] = []

    this.config.conditionalMiddleware.forEach(({ condition, middleware }) => {
      if (matchesCondition(condition, route)) {
        applicableMiddleware.push(...middleware)
      }
    })

    return applicableMiddleware
  }

  private normalizeBasePath(path: string): string {
    const fullPath = this.config.basePath + path
    return fullPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
  }

  // Core route registration methods
  get(path: string, ...handlers: Handler[]): RouteGroup {
    return this.addRoute('GET', path, handlers)
  }

  post(path: string, ...handlers: Handler[]): RouteGroup {
    return this.addRoute('POST', path, handlers)
  }

  put(path: string, ...handlers: Handler[]): RouteGroup {
    return this.addRoute('PUT', path, handlers)
  }

  delete(path: string, ...handlers: Handler[]): RouteGroup {
    return this.addRoute('DELETE', path, handlers)
  }

  patch(path: string, ...handlers: Handler[]): RouteGroup {
    return this.addRoute('PATCH', path, handlers)
  }

  head(path: string, ...handlers: Handler[]): RouteGroup {
    return this.addRoute('HEAD', path, handlers)
  }

  options(path: string, ...handlers: Handler[]): RouteGroup {
    return this.addRoute('OPTIONS', path, handlers)
  }

  all(path: string, ...handlers: Handler[]): RouteGroup {
    return this.addRoute('ALL', path, handlers)
  }

  private addRoute(method: string, path: string, handlers: Handler[]): RouteGroup {
    const normalizedPath = this.normalizeBasePath(path)

    const routeInfo: RouteInfo = {
      method,
      path: normalizedPath,
      metadata: this.config.metadata,
      handlers
    }

    // Apply conditional middleware
    const conditionalMiddleware = this.applyConditionalMiddleware(routeInfo)
    const allHandlers = [...conditionalMiddleware, ...handlers]

    // Register route with Hono app
    switch (method) {
      case 'GET':
        this.app.get(path, ...allHandlers)
        break
      case 'POST':
        this.app.post(path, ...allHandlers)
        break
      case 'PUT':
        this.app.put(path, ...allHandlers)
        break
      case 'DELETE':
        this.app.delete(path, ...allHandlers)
        break
      case 'PATCH':
        this.app.patch(path, ...allHandlers)
        break
      case 'OPTIONS':
        this.app.options(path, ...allHandlers)
        break
      case 'ALL':
        this.app.all(path, ...allHandlers)
        break
    }

    this.config.routes.push(routeInfo)
    return this
  }

  // Middleware management
  use(...middleware: MiddlewareHandler[]): RouteGroup {
    this.config.middleware.push(...middleware)
    middleware.forEach(mw => this.app.use(mw))
    return this
  }

  useIf(condition: (route: RouteInfo) => boolean, ...middleware: MiddlewareHandler[]): RouteGroup {
    this.config.conditionalMiddleware.push({
      condition,
      middleware
    })
    return this
  }

  // Group management
  group(basePath: string, options?: Omit<RouteGroupOptions, 'basePath'>): RouteGroup {
    const fullBasePath = this.normalizeBasePath(basePath)

    const subGroup = new RouteGroup({
      ...options,
      basePath: fullBasePath
    })

    subGroup.parentGroup = this
    subGroup.setupMiddleware()

    this.config.subGroups.push(subGroup)
    return subGroup
  }

  // Metadata management
  withMetadata(metadata: RouteMetadata): RouteGroup {
    this.config.metadata = mergeMetadata(this.config.metadata, metadata)
    return this
  }

  tag(...tags: string[]): RouteGroup {
    return this.withMetadata({ tags })
  }

  describe(description: string): RouteGroup {
    return this.withMetadata({ description })
  }

  deprecate(deprecated = true): RouteGroup {
    return this.withMetadata({ deprecated })
  }

  requireAuth(roles?: string[]): RouteGroup {
    return this.withMetadata({ auth: roles || true })
  }

  rateLimit(requests: number, window: number): RouteGroup {
    return this.withMetadata({ rateLimit: { requests, window } })
  }

  cache(ttl: number, key?: string): RouteGroup {
    return this.withMetadata({ cache: { ttl, key } })
  }

  // Error boundary management
  errorBoundary(handler: ErrorBoundaryHandler): RouteGroup {
    this.config.errorBoundary = handler
    this.app.use(createErrorBoundary(handler))
    return this
  }

  // Integration with Hono
  getHonoApp(): Hono {
    // Create a new Hono instance that includes all sub-groups
    const combinedApp = new Hono()

    // Mount this group's app
    combinedApp.route(this.config.basePath, this.app)

    // Mount all sub-groups
    this.config.subGroups.forEach(subGroup => {
      const subApp = subGroup.getHonoApp()
      combinedApp.route('', subApp)
    })

    return combinedApp
  }

  mount(parentApp: Hono, mountPath?: string): void {
    const path = mountPath || this.config.basePath
    const honoApp = this.getHonoApp()
    parentApp.route(path, honoApp)
  }

  // Introspection methods
  getRoutes(): RouteInfo[] {
    const allRoutes = [...this.config.routes]

    this.config.subGroups.forEach(subGroup => {
      allRoutes.push(...subGroup.getRoutes())
    })

    return allRoutes
  }

  getRoutesWithMetadata(filter?: (metadata: RouteMetadata) => boolean): RouteInfo[] {
    const routes = this.getRoutes()

    if (!filter) {
      return routes
    }

    return routes.filter(route => filter(route.metadata))
  }

  getConfig(): Readonly<RouteGroupConfig> {
    return Object.freeze({ ...this.config })
  }

  // Performance optimization methods
  precompileRoutes(): void {
    // Pre-compile route patterns for better performance
    this.config.routes.forEach(route => {
      // Route compilation would happen here
      // This is a placeholder for route optimization
    })

    this.config.subGroups.forEach(subGroup => {
      subGroup.precompileRoutes()
    })
  }

  getMiddlewareChain(path: string, method: string): MiddlewareHandler[] {
    // Build the complete middleware chain for a specific route
    const chain: MiddlewareHandler[] = []

    // Add inherited middleware
    if (this.parentGroup && this.config.inheritMiddleware) {
      chain.push(...this.parentGroup.getInheritedMiddleware())
    }

    // Add group middleware
    chain.push(...this.config.middleware)

    // Add conditional middleware
    const route = this.config.routes.find(r => r.path === path && r.method === method)
    if (route) {
      const conditionalMw = this.applyConditionalMiddleware(route)
      chain.push(...conditionalMw)
    }

    return chain
  }

  // Utility methods
  clone(): RouteGroup {
    const cloned = new RouteGroup({
      basePath: this.config.basePath,
      middleware: [...this.config.middleware],
      errorBoundary: this.config.errorBoundary,
      metadata: { ...this.config.metadata },
      inheritMiddleware: this.config.inheritMiddleware
    })

    cloned.config.routes = [...this.config.routes]
    cloned.config.conditionalMiddleware = [...this.config.conditionalMiddleware]

    return cloned
  }

  merge(other: RouteGroup): RouteGroup {
    // Merge two route groups
    const merged = this.clone()
    const otherConfig = other.getConfig()

    merged.config.middleware.push(...otherConfig.middleware)
    merged.config.routes.push(...otherConfig.routes)
    merged.config.conditionalMiddleware.push(...otherConfig.conditionalMiddleware)
    merged.config.metadata = mergeMetadata(merged.config.metadata, otherConfig.metadata)

    return merged
  }
}

// Factory function for creating route groups
export function createRouteGroup(options?: RouteGroupOptions): RouteGroup {
  return new RouteGroup(options)
}

// Extension to Hono class for backward compatibility and integration
declare module 'hono' {
  interface Hono {
    group(basePath: string, options?: RouteGroupOptions): RouteGroup
    mountGroup(group: RouteGroup, basePath?: string): Hono
  }
}

// Extend Hono prototype (this would be done in an initialization file)
export function extendHono() {
  const HonoPrototype = Hono.prototype as any

  HonoPrototype.group = function(basePath: string, options?: RouteGroupOptions): RouteGroup {
    const group = new RouteGroup({
      ...options,
      basePath
    })

    // Mount the group automatically
    group.mount(this, basePath)

    return group
  }

  HonoPrototype.mountGroup = function(group: RouteGroup, basePath?: string): Hono {
    group.mount(this, basePath)
    return this
  }
}
