// src/middleware/security/validator.ts

import { createMiddleware } from 'hono/factory'
import type { ValidationSchema, InferValidated } from './types'

export const validator = <T extends ValidationSchema>(schema: T) => {
  return createMiddleware<{
    Variables: {
      validated: InferValidated<T>
    }
  }>(async (c, next) => {
    const validated = {} as InferValidated<T>

    // Validate body
    if (schema.body) {
      const body = await c.req.json().catch(() => ({}))
      const result = schema.body(body)
      if (!result.success) {
        return c.json({ error: 'Invalid body', details: result.error }, 400)
      }
      validated.body = result.data
    }

    // Validate params
    if (schema.params) {
      const params = c.req.param()
      const result = schema.params(params)
      if (!result.success) {
        return c.json({ error: 'Invalid params', details: result.error }, 400)
      }
      validated.params = result.data
    }

    // Validate query
    if (schema.query) {
      const query = c.req.query()
      const result = schema.query(query)
      if (!result.success) {
        return c.json({ error: 'Invalid query', details: result.error }, 400)
      }
      validated.query = result.data
    }

    // Validate headers
    if (schema.headers) {
      const headers = Object.fromEntries(c.req.raw.headers.entries())
      const result = schema.headers(headers)
      if (!result.success) {
        return c.json({ error: 'Invalid headers', details: result.error }, 400)
      }
      validated.headers = result.data
    }

    c.set('validated', validated)
    await next()
  })
}

// Helper functions for common validation patterns
export const createStringValidator = (options: {
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  required?: boolean
} = {}) => {
  return (value: any) => {
    if (options.required && (value === undefined || value === null || value === '')) {
      return { success: false, error: 'Required field is missing' }
    }

    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        return { success: false, error: 'Must be a string' }
      }

      if (options.minLength && value.length < options.minLength) {
        return { success: false, error: `Must be at least ${options.minLength} characters` }
      }

      if (options.maxLength && value.length > options.maxLength) {
        return { success: false, error: `Must be no more than ${options.maxLength} characters` }
      }

      if (options.pattern && !options.pattern.test(value)) {
        return { success: false, error: 'Invalid format' }
      }
    }

    return { success: true, data: value }
  }
}

export const createNumberValidator = (options: {
  min?: number
  max?: number
  integer?: boolean
  required?: boolean
} = {}) => {
  return (value: any) => {
    if (options.required && (value === undefined || value === null)) {
      return { success: false, error: 'Required field is missing' }
    }

    if (value !== undefined && value !== null) {
      const num = Number(value)

      if (isNaN(num)) {
        return { success: false, error: 'Must be a number' }
      }

      if (options.integer && !Number.isInteger(num)) {
        return { success: false, error: 'Must be an integer' }
      }

      if (options.min !== undefined && num < options.min) {
        return { success: false, error: `Must be at least ${options.min}` }
      }

      if (options.max !== undefined && num > options.max) {
        return { success: false, error: `Must be no more than ${options.max}` }
      }

      return { success: true, data: num }
    }

    return { success: true, data: value }
  }
}
