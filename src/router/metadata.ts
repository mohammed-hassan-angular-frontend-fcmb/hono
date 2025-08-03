// src/router/metadata.ts
import type { Context } from 'hono'
import type { RouteMetadata, RouteInfo } from './types'

/**
 * Metadata utility functions
 */

/**
 * Merges two metadata objects with intelligent handling of arrays and objects
 */
export function mergeMetadata(base: RouteMetadata, override: RouteMetadata): RouteMetadata {
  const result: RouteMetadata = { ...base }

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || value === null) {
      continue
    }

    if (key === 'tags' && Array.isArray(value) && Array.isArray(result.tags)) {
      // Merge tags arrays and remove duplicates
      result.tags = [...new Set([...result.tags, ...value])]
    } else if (typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      // Deep merge objects
      result[key] = { ...result[key], ...value }
    } else {
      // Direct assignment for primitives and other types
      result[key] = value
    }
  }

  return result
}

/**
 * Evaluates if a route matches a condition based on its metadata
 */
export function matchesCondition(condition: (route: RouteInfo) => boolean, route: RouteInfo): boolean {
  try {
    return condition(route)
  } catch (error) {
    console.warn('Error evaluating route condition:', error)
    return false
  }
}

/**
 * Metadata condition builders
 */
export const MetadataConditions = {
  // Tag-based conditions
  hasTag: (tag: string) => (route: RouteInfo) =>
    Array.isArray(route.metadata.tags) && route.metadata.tags.includes(tag),

  hasAnyTag: (tags: string[]) => (route: RouteInfo) =>
    Array.isArray(route.metadata.tags) && tags.some(tag => route.metadata.tags!.includes(tag)),

  hasAllTags: (tags: string[]) => (route: RouteInfo) =>
    Array.isArray(route.metadata.tags) && tags.every(tag => route.metadata.tags!.includes(tag)),

  // Authentication conditions
  requiresAuth: () => (route: RouteInfo) => Boolean(route.metadata.auth),

  hasRole: (role: string) => (route: RouteInfo) => {
    const auth = route.metadata.auth
    return Array.isArray(auth) && auth.includes(role)
  },

  hasAnyRole: (roles: string[]) => (route: RouteInfo) => {
    const auth = route.metadata.auth
    return Array.isArray(auth) && roles.some(role => auth.includes(role))
  },

  // Deprecation conditions
  isDeprecated: () => (route: RouteInfo) => Boolean(route.metadata.deprecated),

  isNotDeprecated: () => (route: RouteInfo) => !route.metadata.deprecated,

  // Rate limiting conditions
  hasRateLimit: () => (route: RouteInfo) => Boolean(route.metadata.rateLimit),

  exceedsRateLimit: (maxRequests: number) => (route: RouteInfo) => {
    const rateLimit = route.metadata.rateLimit
    return rateLimit ? rateLimit.requests > maxRequests : false
  },

  // Caching conditions
  isCacheable: () => (route: RouteInfo) => Boolean(route.metadata.cache),

  hasCacheTTL: (minTTL: number) => (route: RouteInfo) => {
    const cache = route.metadata.cache
    return cache ? cache.ttl >= minTTL : false
  },

  // Path-based conditions
  pathMatches: (pattern: RegExp) => (route: RouteInfo) => pattern.test(route.path),

  pathStartsWith: (prefix: string) => (route: RouteInfo) => route.path.startsWith(prefix),

  pathEndsWith: (suffix: string) => (route: RouteInfo) => route.path.endsWith(suffix),

  // Method-based conditions
  isMethod: (method: string) => (route: RouteInfo) => route.method === method.toUpperCase(),

  isAnyMethod: (methods: string[]) => (route: RouteInfo) =>
    methods.map(m => m.toUpperCase()).includes(route.method),

  // Custom metadata conditions
  hasMetadata: (key: string) => (route: RouteInfo) => key in route.metadata,

  metadataEquals: (key: string, value: any) => (route: RouteInfo) => route.metadata[key] === value,

  metadataMatches: (key: string, predicate: (value: any) => boolean) => (route: RouteInfo) => {
    const value = route.metadata[key]
    return value !== undefined && predicate(value)
  },

  // Composite conditions
  and: (...conditions: Array<(route: RouteInfo) => boolean>) => (route: RouteInfo) =>
    conditions.every(condition => condition(route)),

  or: (...conditions: Array<(route: RouteInfo) => boolean>) => (route: RouteInfo) =>
    conditions.some(condition => condition(route)),

  not: (condition: (route: RouteInfo) => boolean) => (route: RouteInfo) =>
    !condition(route)
}

/**
 * Metadata validators
 */
export const MetadataValidators = {
  validateTags: (tags: any): tags is string[] => {
    return Array.isArray(tags) && tags.every(tag => typeof tag === 'string' && tag.length > 0)
  },

  validateAuth: (auth: any): auth is boolean | string[] => {
    return typeof auth === 'boolean' ||
           (Array.isArray(auth) && auth.every(role => typeof role === 'string'))
  },

  validateRateLimit: (rateLimit: any): rateLimit is { requests: number; window: number } => {
    return typeof rateLimit === 'object' &&
           rateLimit !== null &&
           typeof rateLimit.requests === 'number' &&
           typeof rateLimit.window === 'number' &&
           rateLimit.requests > 0 &&
           rateLimit.window > 0
  },

  validateCache: (cache: any): cache is { ttl: number; key?: string } => {
    return typeof cache === 'object' &&
           cache !== null &&
           typeof cache.ttl === 'number' &&
           cache.ttl > 0 &&
           (cache.key === undefined || typeof cache.key === 'string')
  },

  validateDescription: (description: any): description is string => {
    return typeof description === 'string' && description.length > 0
  },

  validateDeprecated: (deprecated: any): deprecated is boolean => {
    return typeof deprecated === 'boolean'
  }
}

/**
 * Metadata extractors for runtime introspection
 */
export class MetadataExtractor {
  /**
   * Extract all unique tags from a collection of routes
   */
  static extractAllTags(routes: RouteInfo[]): string[] {
    const allTags = new Set<string>()

    routes.forEach(route => {
      if (Array.isArray(route.metadata.tags)) {
        route.metadata.tags.forEach(tag => allTags.add(tag))
      }
    })

    return Array.from(allTags).sort()
  }

  /**
   * Extract all authentication roles from routes
   */
  static extractAuthRoles(routes: RouteInfo[]): string[] {
    const roles = new Set<string>()

    routes.forEach(route => {
      const auth = route.metadata.auth
      if (Array.isArray(auth)) {
        auth.forEach(role => roles.add(role))
      }
    })

    return Array.from(roles).sort()
  }

  /**
   * Extract rate limit configurations
   */
  static extractRateLimits(routes: RouteInfo[]): Array<{ requests: number; window: number; paths: string[] }> {
    const rateLimitMap = new Map<string, { requests: number; window: number; paths: string[] }>()

    routes.forEach(route => {
      const rateLimit = route.metadata.rateLimit
      if (rateLimit) {
        const key = `${rateLimit.requests}:${rateLimit.window}`
        const existing = rateLimitMap.get(key)

        if (existing) {
          existing.paths.push(route.path)
        } else {
          rateLimitMap.set(key, {
            requests: rateLimit.requests,
            window: rateLimit.window,
            paths: [route.path]
          })
        }
      }
    })

    return Array.from(rateLimitMap.values())
  }

  /**
   * Extract cache configurations
   */
  static extractCacheConfigs(routes: RouteInfo[]): Array<{ ttl: number; key?: string; paths: string[] }> {
    const cacheMap = new Map<string, { ttl: number; key?: string; paths: string[] }>()

    routes.forEach(route => {
      const cache = route.metadata.cache
      if (cache) {
        const key = `${cache.ttl}:${cache.key || 'default'}`
        const existing = cacheMap.get(key)

        if (existing) {
          existing.paths.push(route.path)
        } else {
          cacheMap.set(key, {
            ttl: cache.ttl,
            key: cache.key,
            paths: [route.path]
          })
        }
      }
    })

    return Array.from(cacheMap.values())
  }

  /**
   * Get routes grouped by metadata property
   */
  static groupByMetadata<T>(routes: RouteInfo[], key: string): Map<T, RouteInfo[]> {
    const groups = new Map<T, RouteInfo[]>()

    routes.forEach(route => {
      const value = route.metadata[key] as T
      if (value !== undefined) {
        const existing = groups.get(value) || []
        existing.push(route)
        groups.set(value, existing)
      }
    })

    return groups
  }

  /**
   * Get metadata statistics
   */
  static getMetadataStats(routes: RouteInfo[]): {
    totalRoutes: number
    withAuth: number
    deprecated: number
    withRateLimit: number
    withCache: number
    withTags: number
    uniqueTags: number
    authRoles: number
  } {
    const stats = {
      totalRoutes: routes.length,
      withAuth: 0,
      deprecated: 0,
      withRateLimit: 0,
      withCache: 0,
      withTags: 0,
      uniqueTags: 0,
      authRoles: 0
    }

    const allTags = new Set<string>()
    const allRoles = new Set<string>()

    routes.forEach(route => {
      const metadata = route.metadata

      if (metadata.auth) stats.withAuth++
      if (metadata.deprecated) stats.deprecated++
      if (metadata.rateLimit) stats.withRateLimit++
      if (metadata.cache) stats.withCache++

      if (Array.isArray(metadata.tags)) {
        stats.withTags++
        metadata.tags.forEach(tag => allTags.add(tag))
      }

      if (Array.isArray(metadata.auth)) {
        metadata.auth.forEach(role => allRoles.add(role))
      }
    })

    stats.uniqueTags = allTags.size
    stats.authRoles = allRoles.size

    return stats
  }
}

/**
 * Metadata-based middleware factory
 */
export class MetadataMiddleware {
  /**
   * Create middleware that adds metadata to context
   */
  static addToContext(metadataKey: string = 'routeMetadata') {
    return async (c: Context, next: () => Promise<void>) => {
      // This would need integration with the router to get current route metadata
      // For now, we'll set a placeholder
      c.set(metadataKey, {})
      await next()
    }
  }

  /**
   * Create middleware that validates requests based on metadata
   */
  static validateByMetadata(
    validator: (metadata: RouteMetadata, context: Context) => boolean | Promise<boolean>,
    onValidationFail?: (context: Context) => Response | Promise<Response>
  ) {
    return async (c: Context, next: () => Promise<void>) => {
      const metadata = c.get('routeMetadata') as RouteMetadata || {}

      const isValid = await validator(metadata, c)

      if (!isValid) {
        if (onValidationFail) {
          return onValidationFail(c)
        } else {
          return c.json({ error: 'Request validation failed' }, 400)
        }
      }

      await next()
    }
  }

  /**
   * Create CORS middleware based on metadata
   */
  static corsFromMetadata() {
    return async (c: Context, next: () => Promise<void>) => {
      const metadata = c.get('routeMetadata') as RouteMetadata || {}
      const corsConfig = metadata.cors as any

      if (corsConfig) {
        if (corsConfig.origin) {
          c.header('Access-Control-Allow-Origin', corsConfig.origin)
        }
        if (corsConfig.methods) {
          c.header('Access-Control-Allow-Methods', corsConfig.methods.join(', '))
        }
        if (corsConfig.headers) {
          c.header('Access-Control-Allow-Headers', corsConfig.headers.join(', '))
        }
      }

      await next()
    }
  }
}

/**
 * Metadata query builder for complex filtering
 */
export class MetadataQueryBuilder {
  private conditions: Array<(route: RouteInfo) => boolean> = []

  hasTag(tag: string): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.hasTag(tag))
    return this
  }

  hasAnyTag(tags: string[]): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.hasAnyTag(tags))
    return this
  }

  hasAllTags(tags: string[]): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.hasAllTags(tags))
    return this
  }

  requiresAuth(): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.requiresAuth())
    return this
  }

  hasRole(role: string): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.hasRole(role))
    return this
  }

  isDeprecated(): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.isDeprecated())
    return this
  }

  isNotDeprecated(): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.isNotDeprecated())
    return this
  }

  pathMatches(pattern: RegExp): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.pathMatches(pattern))
    return this
  }

  isMethod(method: string): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.isMethod(method))
    return this
  }

  hasMetadata(key: string): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.hasMetadata(key))
    return this
  }

  metadataEquals(key: string, value: any): MetadataQueryBuilder {
    this.conditions.push(MetadataConditions.metadataEquals(key, value))
    return this
  }

  custom(condition: (route: RouteInfo) => boolean): MetadataQueryBuilder {
    this.conditions.push(condition)
    return this
  }

  build(): (route: RouteInfo) => boolean {
    return MetadataConditions.and(...this.conditions)
  }

  execute(routes: RouteInfo[]): RouteInfo[] {
    const condition = this.build()
    return routes.filter(condition)
  }
}

/**
 * Utility functions for working with metadata
 */
export const MetadataUtils = {
  /**
   * Create a metadata query builder
   */
  query: () => new MetadataQueryBuilder(),

  /**
   * Validate metadata object
   */
  validate: (metadata: RouteMetadata): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (metadata.tags && !MetadataValidators.validateTags(metadata.tags)) {
      errors.push('Invalid tags: must be array of non-empty strings')
    }

    if (metadata.auth && !MetadataValidators.validateAuth(metadata.auth)) {
      errors.push('Invalid auth: must be boolean or array of strings')
    }

    if (metadata.rateLimit && !MetadataValidators.validateRateLimit(metadata.rateLimit)) {
      errors.push('Invalid rateLimit: must have positive requests and window numbers')
    }

    if (metadata.cache && !MetadataValidators.validateCache(metadata.cache)) {
      errors.push('Invalid cache: must have positive ttl number')
    }

    if (metadata.description && !MetadataValidators.validateDescription(metadata.description)) {
      errors.push('Invalid description: must be non-empty string')
    }

    if (metadata.deprecated !== undefined && !MetadataValidators.validateDeprecated(metadata.deprecated)) {
      errors.push('Invalid deprecated: must be boolean')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  },

  /**
   * Serialize metadata for storage or transmission
   */
  serialize: (metadata: RouteMetadata): string => {
    return JSON.stringify(metadata, null, 2)
  },

  /**
   * Deserialize metadata from storage or transmission
   */
  deserialize: (serialized: string): RouteMetadata => {
    try {
      return JSON.parse(serialized)
    } catch (error) {
      throw new Error(`Failed to deserialize metadata: ${error}`)
    }
  },

  /**
   * Clone metadata object
   */
  clone: (metadata: RouteMetadata): RouteMetadata => {
    return JSON.parse(JSON.stringify(metadata))
  },

  /**
   * Check if two metadata objects are equal
   */
  equals: (a: RouteMetadata, b: RouteMetadata): boolean => {
    return JSON.stringify(a) === JSON.stringify(b)
  }
}

/**
 * Predefined metadata configurations
 */
export const MetadataPresets = {
  // Public API endpoints
  publicApi: (): RouteMetadata => ({
    tags: ['api', 'public'],
    auth: false,
    cache: { ttl: 300 } // 5 minutes
  }),

  // Admin endpoints
  admin: (roles: string[] = ['admin']): RouteMetadata => ({
    tags: ['admin'],
    auth: roles,
    rateLimit: { requests: 100, window: 3600 } // 100 requests per hour
  }),

  // Deprecated endpoints
  deprecated: (description?: string): RouteMetadata => ({
    deprecated: true,
    description: description || 'This endpoint is deprecated'
  }),

  // High-traffic endpoints
  highTraffic: (cacheTime: number = 60): RouteMetadata => ({
    tags: ['high-traffic'],
    cache: { ttl: cacheTime },
    rateLimit: { requests: 1000, window: 3600 }
  }),

  // Internal API endpoints
  internal: (): RouteMetadata => ({
    tags: ['internal'],
    auth: ['internal'],
    description: 'Internal API endpoint'
  })
}
