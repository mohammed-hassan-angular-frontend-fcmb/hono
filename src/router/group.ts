// src/router/group.ts
import type { MiddlewareHandler, ErrorHandler } from '../types'

interface RouteGroupOptions {
  basePath?: string;
  middleware?: MiddlewareHandler[];
  errorBoundary?: ErrorHandler;
  metadata?: Record<string, any>;
  inheritMiddleware?: boolean;
}

interface Handler {
  // Define handler interface
}

interface RouteInfo {
  // Define route info interface
}

class RouteGroup {
  private basePath: string;
  private middleware: MiddlewareHandler[];
  private errorBoundary?: ErrorHandler;
  private metadata: Record<string, any>;
  private inheritMiddleware: boolean;

  constructor(options: RouteGroupOptions = {}) {
    this.basePath = options.basePath || '';
    this.middleware = options.middleware || [];
    this.errorBoundary = options.errorBoundary;
    this.metadata = options.metadata || {};
    this.inheritMiddleware = options.inheritMiddleware ?? true;
  }

  use(...middleware: MiddlewareHandler[]): RouteGroup {
    this.middleware.push(...middleware);
    return this;
  }

  group(path: string, options?: RouteGroupOptions): RouteGroup {
    const fullPath = this.basePath + path;
    const inheritedMiddleware = this.inheritMiddleware ? this.middleware : [];
    return new RouteGroup({
      basePath: fullPath,
      middleware: [...inheritedMiddleware, ...(options?.middleware || [])],
      ...options
    });
  }

  route(method: string, path: string, ...handlers: Handler[]): RouteGroup {
    // Implementation for route method
    return this;
  }

  setErrorBoundary(handler: ErrorHandler): RouteGroup {
    this.errorBoundary = handler;
    return this;
  }

  applyMiddleware(condition: (route: RouteInfo) => boolean, ...middleware: MiddlewareHandler[]): RouteGroup {
    // Implementation for conditional middleware
    return this;
  }
}

// Enhanced Hono class integration
class Hono {
  group(path: string, options?: RouteGroupOptions): RouteGroup {
    return new RouteGroup({ basePath: path, ...options });
  }
  // ... existing methods
}
