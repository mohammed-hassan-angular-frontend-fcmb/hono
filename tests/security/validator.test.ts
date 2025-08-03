// tests/security/validator.test.ts
import { Hono } from 'hono'
import { describe, it, expect, beforeEach } from 'vitest'
import { validator, createStringValidator, createNumberValidator } from '../../src/middleware/security'

describe('Validator Middleware', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
  })

  describe('Body Validation', () => {
    it('should validate request body successfully', async () => {
      app.post('/',
        validator({
          body: (data) => {
            if (!data.name || typeof data.name !== 'string') {
              return { success: false, error: 'Name is required' }
            }
            return { success: true, data: { name: data.name } }
          }
        }),
        (c) => {
          const { body } = c.var.validated
          return c.json({ message: `Hello ${body.name}` })
        }
      )

      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John' })
      })

      expect(res.status).toBe(200)
      const result = await res.json()
      expect(result.message).toBe('Hello John')
    })

    it('should reject invalid body', async () => {
      app.post('/',
        validator({
          body: (data) => {
            if (!data.name) {
              return { success: false, error: 'Name is required' }
            }
            return { success: true, data }
          }
        }),
        (c) => c.json({ success: true })
      )

      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      expect(res.status).toBe(400)
      const result = await res.json()
      expect(result.error).toBe('Invalid body')
      expect(result.details).toBe('Name is required')
    })
  })

  describe('Parameter Validation', () => {
    it('should validate path parameters', async () => {
      app.get('/users/:id',
        validator({
          params: (data) => {
            const id = parseInt(data.id)
            if (isNaN(id) || id <= 0) {
              return { success: false, error: 'Invalid user ID' }
            }
            return { success: true, data: { id } }
          }
        }),
        (c) => {
          const { params } = c.var.validated
          return c.json({ userId: params.id })
        }
      )

      const validRes = await app.request('/users/123')
      expect(validRes.status).toBe(200)

      const validResult = await validRes.json()
      expect(validResult.userId).toBe(123)

      const invalidRes = await app.request('/users/abc')
      expect(invalidRes.status).toBe(400)
    })
  })

  describe('Query Validation', () => {
    it('should validate query parameters', async () => {
      app.get('/search',
        validator({
          query: (data) => {
            if (!data.q || data.q.length < 2) {
              return { success: false, error: 'Query must be at least 2 characters' }
            }
            return { success: true, data: { q: data.q } }
          }
        }),
        (c) => {
          const { query } = c.var.validated
          return c.json({ searchTerm: query.q })
        }
      )

      const validRes = await app.request('/search?q=hello')
      expect(validRes.status).toBe(200)

      const invalidRes = await app.request('/search?q=h')
      expect(invalidRes.status).toBe(400)
    })
  })

  describe('String Validator Helper', () => {
    it('should validate string length', () => {
      const validator = createStringValidator({ minLength: 3, maxLength: 10 })

      expect(validator('hello').success).toBe(true)
      expect(validator('hi').success).toBe(false)
      expect(validator('verylongstring').success).toBe(false)
    })

    it('should validate string pattern', () => {
      const emailValidator = createStringValidator({
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      })

      expect(emailValidator('user@example.com').success).toBe(true)
      expect(emailValidator('invalid-email').success).toBe(false)
    })

    it('should handle required fields', () => {
      const requiredValidator = createStringValidator({ required: true })

      expect(requiredValidator('').success).toBe(false)
      expect(requiredValidator(null).success).toBe(false)
      expect(requiredValidator(undefined).success).toBe(false)
      expect(requiredValidator('value').success).toBe(true)
    })
  })

  describe('Number Validator Helper', () => {
    it('should validate number range', () => {
      const validator = createNumberValidator({ min: 1, max: 100 })

      expect(validator(50).success).toBe(true)
      expect(validator(0).success).toBe(false)
      expect(validator(101).success).toBe(false)
    })

    it('should validate integers', () => {
      const intValidator = createNumberValidator({ integer: true })

      expect(intValidator(42).success).toBe(true)
      expect(intValidator(42.5).success).toBe(false)
    })
  })
})
