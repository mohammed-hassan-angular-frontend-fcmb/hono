// src/middleware/security/rate-limit.ts

import type { Context } from '../../context';
import { createMiddleware } from '../../helper/factory';

interface RateLimitStore {
  get(key: string): Promise<number | undefined>;
  set(key: string, value: number, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<number>;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
  store?: RateLimitStore;
  skipFailedRequests?: boolean;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  current: number;
}

export const rateLimit = (options: RateLimitOptions) =>
  createMiddleware<{ Variables: { rateLimitInfo: RateLimitInfo } }>
