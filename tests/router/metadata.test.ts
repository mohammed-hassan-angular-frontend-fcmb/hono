

import { describe, it, expect } from 'vitest'
import {
  mergeMetadata,
  MetadataConditions,
  MetadataValidators,
  MetadataExtractor,
  MetadataQueryBuilder,
  MetadataUtils,
  MetadataPresets
} from '../../src/router/metadata'
import type { RouteInfo, RouteMetadata } from '../../src/router/types'

describe('Metadata Utilities', () => {
  const mockRoute: RouteInfo = {
    method: 'GET',
    path: '/api/users',
    metadata: {
      tags: ['api', 'users'],
      auth: ['admin', 'user'],
      deprecated: false,
      rateLimit: { requests: 100, window: 3600 }
    },
    handlers: []
  }

  describe('mergeMetadata', () => {
    it('should merge metadata objects correctly', () => {
      const base: RouteMetadata = { tags: ['api'], auth: true }
      const override: RouteMetadata = { tags: ['users'], deprecated: false }

      const result = mergeMetadata(base, override)

      expect(result.tags).toEqual(['api', 'users'])
      expect(result.auth).toBe(true)
      expect(result.deprecated).toBe(false)
    })
  })

  describe('MetadataConditions', () => {
    it('should check if route has tag', () => {
      const condition = MetadataConditions.hasTag('api')
      expect(condition(mockRoute)).toBe(true)
      expect(condition({ ...mockRoute, metadata: { tags: ['other'] } })).toBe(false)
    })

    it('should check if route requires auth', () => {
      const condition = MetadataConditions.requiresAuth()
      expect(condition(mockRoute)).toBe(true)
      expect(condition({ ...mockRoute, metadata: {} })).toBe(false)
    })

    it('should check if route has role', () => {
      const condition = MetadataConditions.hasRole('admin')
      expect(condition(mockRoute)).toBe(true)
      expect(condition({ ...mockRoute, metadata: { auth: ['user'] } })).toBe(false)
    })
  })

  describe('MetadataValidators', () => {
    it('should validate tags', () => {
      expect(MetadataValidators.validateTags(['api', 'users'])).toBe(true)
      expect(MetadataValidators.validateTags([''])).toBe(false)
      expect(MetadataValidators.validateTags('not-array')).toBe(false)
    })

    it('should validate auth', () => {
      expect(MetadataValidators.validateAuth(true)).toBe(true)
      expect(MetadataValidators.validateAuth(['admin'])).toBe(true)
      expect(MetadataValidators.validateAuth('invalid')).toBe(false)
    })

    it('should validate rate limit', () => {
      expect(MetadataValidators.validateRateLimit({ requests: 100, window: 3600 })).toBe(true)
      expect(MetadataValidators.validateRateLimit({ requests: -1, window: 3600 })).toBe(false)
    })
  })

  describe('MetadataExtractor', () => {
    const routes: RouteInfo[] = [
      mockRoute,
      {
        method: 'POST',
        path: '/api/posts',
        metadata: { tags: ['api', 'posts'], auth: ['editor'] },
        handlers: []
      }
    ]

    it('should extract all tags', () => {
      const tags = MetadataExtractor.extractAllTags(routes)
      expect(tags).toEqual(['api', 'posts', 'users'])
    })

    it('should extract auth roles', () => {
      const roles = MetadataExtractor.extractAuthRoles(routes)
      expect(roles).toEqual(['admin', 'editor', 'user'])
    })

    it('should get metadata stats', () => {
      const stats = MetadataExtractor.getMetadataStats(routes)
      expect(stats.totalRoutes).toBe(2)
      expect(stats.withAuth).toBe(2)
      expect(stats.uniqueTags).toBe(3)
    })
  })

  describe('MetadataQueryBuilder', () => {
    it('should build complex queries', () => {
      const routes: RouteInfo[] = [mockRoute]

      const result = new MetadataQueryBuilder()
        .hasTag('api')
        .requiresAuth()
        .execute(routes)

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(mockRoute)
    })
  })

  describe('MetadataUtils', () => {
    it('should validate metadata', () => {
      const valid = MetadataUtils.validate({
        tags: ['api'],
        auth: true,
        deprecated: false
      })

      expect(valid.valid).toBe(true)
      expect(valid.errors).toHaveLength(0)
    })

    it('should serialize and deserialize metadata', () => {
      const metadata: RouteMetadata = { tags: ['api'], auth: true }
      const serialized = MetadataUtils.serialize(metadata)
      const deserialized = MetadataUtils.deserialize(serialized)

      expect(deserialized).toEqual(metadata)
    })
  })

  describe('MetadataPresets', () => {
    it('should create public API preset', () => {
      const preset = MetadataPresets.publicApi()

      expect(preset.tags).toContain('public')
      expect(preset.auth).toBe(false)
      expect(preset.cache).toBeDefined()
    })

    it('should create admin preset', () => {
      const preset = MetadataPresets.admin(['superadmin'])

      expect(preset.tags).toContain('admin')
      expect(preset.auth).toEqual(['superadmin'])
      expect(preset.rateLimit).toBeDefined()
    })
  })
})

