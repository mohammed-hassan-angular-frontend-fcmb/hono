// src/plugin/manager.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { BlankEnv, Env, Input } from '../types'
import type { HonoPlugin } from './plugin'


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
