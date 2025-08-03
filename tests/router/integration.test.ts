import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from '../../src/hono'
import type { RequestIdVariables } from '../../src/middleware/request-id/request-id'

describe('Router Integration Tests', () => {
  let app: Hono<{ Variables: RequestIdVariables }>

  beforeEach(() => {
    app = new Hono()
  })

  it('should integrate with router and nested routes', async () => {
    const apiRouter = new Hono<{ Variables: RequestIdVariables }>()
    apiRouter.get('/users', (c) => c.json({ users: ['alice', 'bob'] }))
    apiRouter.get('/posts/:id', (c) => {
      const id = c.req.param('id')
      return c.json({ post: `Post ${id}`, requestId: c.get('requestId') })
    })

    app.use('*', async (c, next) => {
      c.set('requestId', 'router-test-456')
      await next()
    })

    app.route('/api', apiRouter)

    const usersRes = await app.request('/api/users')
    const postRes = await app.request('/api/posts/123')

    expect(usersRes.status).toBe(200)
    expect(postRes.status).toBe(200)

    const usersData = await usersRes.json()
    const postData = await postRes.json()

    expect(usersData.users).toEqual(['alice', 'bob'])
    expect(postData.post).toBe('Post 123')
    expect(postData.requestId).toBe('router-test-456')
  })

  it('should handle multiple nested routers', async () => {
    const v1Router = new Hono<{ Variables: RequestIdVariables }>()
    const v2Router = new Hono<{ Variables: RequestIdVariables }>()
    const adminRouter = new Hono<{ Variables: RequestIdVariables }>()

    v1Router.get('/status', (c) => c.json({ version: 'v1', requestId: c.get('requestId') }))
    v2Router.get('/status', (c) => c.json({ version: 'v2', requestId: c.get('requestId') }))
    adminRouter.get('/health', (c) => c.json({ status: 'healthy', requestId: c.get('requestId') }))

    app.use('*', async (c, next) => {
      c.set('requestId', 'nested-test-789')
      await next()
    })

    app.route('/api/v1', v1Router)
    app.route('/api/v2', v2Router)
    app.route('/admin', adminRouter)

    const v1Res = await app.request('/api/v1/status')
    const v2Res = await app.request('/api/v2/status')
    const adminRes = await app.request('/admin/health')

    expect(v1Res.status).toBe(200)
    expect(v2Res.status).toBe(200)
    expect(adminRes.status).toBe(200)

    const v1Data = await v1Res.json()
    const v2Data = await v2Res.json()
    const adminData = await adminRes.json()

    expect(v1Data.version).toBe('v1')
    expect(v2Data.version).toBe('v2')
    expect(adminData.status).toBe('healthy')
    expect(v1Data.requestId).toBe('nested-test-789')
    expect(v2Data.requestId).toBe('nested-test-789')
    expect(adminData.requestId).toBe('nested-test-789')
  })

  it('should handle middleware chain with routers', async () => {
    const apiRouter = new Hono<{ Variables: RequestIdVariables }>()

    apiRouter.use('*', async (c, next) => {
      c.header('X-API-Version', '1.0')
      await next()
    })

    apiRouter.get('/data', (c) => c.json({
      data: 'test',
      requestId: c.get('requestId'),
      timestamp: Date.now()
    }))

    app.use('*', async (c, next) => {
      c.set('requestId', 'middleware-chain-123')
      c.header('X-Request-Start', Date.now().toString())
      await next()
    })

    app.route('/api', apiRouter)

    const res = await app.request('/api/data')

    expect(res.status).toBe(200)
    expect(res.headers.get('X-API-Version')).toBe('1.0')
    expect(res.headers.get('X-Request-Start')).toBeTruthy()

    const data = await res.json()
    expect(data.data).toBe('test')
    expect(data.requestId).toBe('middleware-chain-123')
    expect(data.timestamp).toBeTypeOf('number')
  })

  it('should handle different HTTP methods on routers', async () => {
    const crudRouter = new Hono<{ Variables: RequestIdVariables }>()

    crudRouter.get('/items', (c) => c.json({ items: [], requestId: c.get('requestId') }))
    crudRouter.post('/items', async (c) => {
      const body = await c.req.json()
      return c.json({ created: body, requestId: c.get('requestId') }, 201)
    })
    crudRouter.put('/items/:id', async (c) => {
      const id = c.req.param('id')
      const body = await c.req.json()
      return c.json({ updated: { id, ...body }, requestId: c.get('requestId') })
    })
    crudRouter.delete('/items/:id', (c) => {
      const id = c.req.param('id')
      return c.json({ deleted: id, requestId: c.get('requestId') })
    })

    app.use('*', async (c, next) => {
      c.set('requestId', 'crud-test-999')
      await next()
    })

    app.route('/api', crudRouter)

    const getRes = await app.request('/api/items')
    const postRes = await app.request('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test item' })
    })
    const putRes = await app.request('/api/items/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated item' })
    })
    const deleteRes = await app.request('/api/items/1', { method: 'DELETE' })

    expect(getRes.status).toBe(200)
    expect(postRes.status).toBe(201)
    expect(putRes.status).toBe(200)
    expect(deleteRes.status).toBe(200)

    const getData = await getRes.json()
    const postData = await postRes.json()
    const putData = await putRes.json()
    const deleteData = await deleteRes.json()

    expect(getData.items).toEqual([])
    expect(postData.created.name).toBe('test item')
    expect(putData.updated.name).toBe('updated item')
    expect(deleteData.deleted).toBe('1')

    expect(getData.requestId).toBe('crud-test-999')
    expect(postData.requestId).toBe('crud-test-999')
    expect(putData.requestId).toBe('crud-test-999')
    expect(deleteData.requestId).toBe('crud-test-999')
  })

  it('should handle route parameters and query strings', async () => {
    const searchRouter = new Hono<{ Variables: RequestIdVariables }>()

    searchRouter.get('/search/:category', (c) => {
      const category = c.req.param('category')
      const query = c.req.query('q')
      const limit = c.req.query('limit') || '10'

      return c.json({
        category,
        query,
        limit: parseInt(limit),
        requestId: c.get('requestId')
      })
    })

    app.use('*', async (c, next) => {
      c.set('requestId', 'search-test-555')
      await next()
    })

    app.route('/api', searchRouter)

    const res = await app.request('/api/search/books?q=javascript&limit=5')

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.category).toBe('books')
    expect(data.query).toBe('javascript')
    expect(data.limit).toBe(5)
    expect(data.requestId).toBe('search-test-555')
  })

  it('should handle 404 for non-existent routes', async () => {
    const apiRouter = new Hono<{ Variables: RequestIdVariables }>()
    apiRouter.get('/exists', (c) => c.json({ exists: true }))

    app.use('*', async (c, next) => {
      c.set('requestId', 'not-found-test')
      await next()
    })

    app.route('/api', apiRouter)

    const existsRes = await app.request('/api/exists')
    const notFoundRes = await app.request('/api/does-not-exist')

    expect(existsRes.status).toBe(200)
    expect(notFoundRes.status).toBe(404)
  })

  it('should preserve context variables across router boundaries', async () => {
    const userRouter = new Hono<{ Variables: RequestIdVariables }>()

    userRouter.use('*', async (c, next) => {
      // Router-level middleware can access parent context
      const parentRequestId = c.get('requestId')
      expect(parentRequestId).toBeTruthy()
      await next()
    })

    userRouter.get('/profile', (c) => {
      return c.json({
        profile: { name: 'John Doe' },
        requestId: c.get('requestId')
      })
    })

    app.use('*', async (c, next) => {
      c.set('requestId', 'context-test-777')
      await next()
    })

    app.route('/users', userRouter)

    const res = await app.request('/users/profile')

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.profile.name).toBe('John Doe')
    expect(data.requestId).toBe('context-test-777')
  })
})
