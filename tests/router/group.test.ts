// tests/router/group.test.ts
import { Hono } from 'hono'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RouteGroup } from '../../src/router/group'
import '../../src/router' // Import to extend Hono

describe('Route Group Management', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  describe('Basic Group Creation', () => {
    it('should create route group with base path', async () => {
      const api = app.group('/api')
      api.get('/users', (c) => c.json({ users: [] }))

      const res = await app.request('/api/users')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.users).toEqual([])
    })

    it('should handle nested groups', async () => {
      const api = app.group('/api')
      const v1 = api.group('/v1')
      const users = v1.group('/users')

      users.get('/:id', (c) => c.json({ id: c.req.param('id') }))

      const res = await app.request('/api/v1/users/123')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.id).toBe('123')
    })
  })

  describe('Middleware Inheritance', () => {
    it('should inherit middleware from parent groups', async () => {
      const authMiddleware = vi.fn(async (c, next) => {
        c.set('user', { id: 'user123' })
        await next()
      })

      const logMiddleware = vi.fn(async (c, next) => {
        await next()
      })

      const api = app.group('/api', { middleware: [authMiddleware] })
      const v1 = api.group('/v1', { middleware: [logMiddleware] })

      v1.get('/profile', (c) => {
        const user = c.var.user
        return c.json({ userId: user.id })
      })

      const res = await app.request('/api/v1/profile')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.userId).toBe('user123')

      expect(authMiddleware).toHaveBeenCalled()
      expect(logMiddleware).toHaveBeenCalled()
    })

    it('should not inherit middleware when disabled', async () => {
      const parentMiddleware = vi.fn(async (c, next) => {
        c.set('inherited', true)
        await next()
      })

      const api = app.group('/api', { middleware: [parentMiddleware] })
      const isolated = api.group('/isolated', { inheritMiddleware: false })

      isolated.get('/test', (c) => {
        const inherited = c.var.inherited
        return c.json({ inherited: !!inherited })
      })

      const res = await app.request('/api/isolated/test')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.inherited).toBe(false)
      expect(parentMiddleware).not.toHaveBeenCalled()
    })
  })

  describe('Error Boundaries', () => {
    it('should catch errors with custom error boundary', async () => {
      const errorBoundary = vi.fn((error, c) => {
        return c.json({ error: 'Custom error handler' }, 500)
      })

      const api = app.group('/api', { errorBoundary })
      api.get('/error', (c) => {
        throw new Error('Test error')
      })

      const res = await app.request('/api/error')
      expect(res.status).toBe(500)

      const data = await res.json()
      expect(data.error).toBe('Custom error handler')
      expect(errorBoundary).toHaveBeenCalled()
    })

    it('should isolate errors to route groups', async () => {
      const group1ErrorHandler = vi.fn((error, c) => {
        return c.json({ handler: 'group1' }, 500)
      })

      const group2ErrorHandler = vi.fn((error, c) => {
        return c.json({ handler: 'group2' }, 500)
      })

      const group1 = app.group('/group1', { errorBoundary: group1ErrorHandler })
      const group2 = app.group('/group2', { errorBoundary: group2ErrorHandler })

      group1.get('/error', () => { throw new Error('Group 1 error') })
      group2.get('/error', () => { throw new Error('Group 2 error') })

      const res1 = await app.request('/group1/error')
      const data1 = await res1.json()
      expect(data1.handler).toBe('group1')

      const res2 = await app.request('/group2/error')
      const data2 = await res2.json()
      expect(data2.handler).toBe('group2')

      expect(group1ErrorHandler).toHaveBeenCalledTimes(1)
      expect(group2ErrorHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('Route Metadata', () => {
    it('should support route metadata', async () => {
      const api = app.group('/api')

      api.get('/public', (c) => c.text('Public'))
      api.tag('private').requireAuth(['admin']).get('/private', (c) => c.text('Private'))

      const routes = api.getRoutes()

      expect(routes).toHaveLength(2)
      expect(routes[1].metadata.tags).toContain('private')
      expect(routes[1].metadata.auth).toContain('admin')
    })

    it('should inherit metadata from group', async () => {
      const api = app.group('/api', {
        metadata: { version: 'v1', deprecated: false }
      })

      api.withMetadata({ resource: 'users' }).get('/users', (c) => c.text('Users'))

      const routes = api.getRoutes()
      const userRoute = routes[0]

      expect(userRoute.metadata.version).toBe('v1')
      expect(userRoute.metadata.deprecated).toBe(false)
      expect(userRoute.metadata.resource).toBe('users')
    })
  })

  describe('Conditional Middleware', () => {
    it('should apply middleware based on conditions', async () => {
      const authMiddleware = vi.fn(async (c, next) => {
        c.set('authenticated', true)
        await next()
      })

      const api = app.group('/api')

      // Apply auth middleware only to routes with auth metadata
      api.useIf(
        (route) => !!route.metadata.auth,
        authMiddleware
      )

      api.get('/public', (c) => c.json({ auth: !!c.var.authenticated }))
      api.withMetadata({ auth: true }).get('/private', (c) => c.json({ auth: !!c.var.authenticated }))

      const publicRes = await app.request('/api/public')
      const publicData = await publicRes.json()
      expect(publicData.auth).toBe(false)

      const privateRes = await app.request('/api/private')
      const privateData = await privateRes.json()
      expect(privateData.auth).toBe(true)

      expect(authMiddleware).toHaveBeenCalledTimes(1)
    })
  })

  describe('Backward Compatibility', () => {
    it('should work alongside traditional routing', async () => {
      // Traditional route
      app.get('/traditional', (c) => c.text('Traditional'))

      // Group route
      const api = app.group('/api')
      api.get('/grouped', (c) => c.text('Grouped'))

      const traditionalRes = await app.request('/traditional')
      expect(traditionalRes.status).toBe(200)
      expect(await traditionalRes.text()).toBe('Traditional')

      const groupedRes = await app.request('/api/grouped')
      expect(groupedRes.status).toBe(200)
      expect(await groupedRes.text()).toBe('Grouped')
    })

    it('should maintain existing app.route() functionality', async () => {
      const subApp = new Hono()
      subApp.get('/sub', (c) => c.text('Sub app'))

      app.route('/mounted', subApp)

      const res = await app.request('/mounted/sub')
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('Sub app')
    })
  })
})
