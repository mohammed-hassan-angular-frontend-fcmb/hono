// src/middleware/security/validator.ts

import type { ZodSchema } from 'zod'
import { createMiddleware } from '../../helper/factory';

interface ValidationSchema {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}

type InferValidated<T extends ValidationSchema> = {
  [K in keyof T]: T[K] extends ZodSchema ? T[K]['_output'] : never
}

export const validator = <T extends ValidationSchema>(schema: T) =>
  createMiddleware<{ Variables: { validated: InferValidated<T> } }>
