// src/plugin/manager.ts

import type { BlankEnv, BlankSchema, Env, Handler, Input, MiddlewareHandler, Schema } from '../types'
import type { HonoPlugin } from './plugin'
// import type { Hono } from '../hono'


class PluginManager<E extends Env = BlankEnv> {
  private plugins: Map<string, HonoPlugin> = new Map()

  register<P extends HonoPlugin>(plugin: P, options?: any): void {
    this.plugins.set(plugin.name, plugin)
  }
  unregister(pluginName: string): void {
    this.plugins.delete(pluginName)
  }
  getPlugin(name: string): HonoPlugin | undefined {
    return this.plugins.get(name)
  }
  listPlugins(): HonoPlugin[] {
    return Array.from(this.plugins.values())
  }
  resolveDependencies(): void {
    // TODO: Implement dependency resolution logic
  }
}

// Enhanced Hono class
class Hono<E extends Env = any, P extends string = any, I extends Input = any> {
  plugins: PluginManager<E> = new PluginManager<E>();

  use<Plugin extends HonoPlugin>(plugin: Plugin, options?: Record<string, unknown>): Hono<E, P, I> {
    this.plugins.register(plugin, options)
    return this
  }
  // ... existing methods
}

// Plugin type extensions
declare module '../context' {
  interface Context<E extends Env = any> {
    plugin: <T extends HonoPlugin>(name: string) => T['contextExtensions'];
  }
}
