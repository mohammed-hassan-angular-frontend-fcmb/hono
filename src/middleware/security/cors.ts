// src/middleware/security/cors.ts

import { createMiddleware } from '../../helper/factory';

interface SmartCORSOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  credentials?: boolean;
  exposedHeaders?: string[];
  maxAge?: number;
  preflightContinue?: boolean;
}

export const smartCORS = (options?: SmartCORSOptions) => createMiddleware

