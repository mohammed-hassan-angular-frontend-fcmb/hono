// src/plugin/plugin.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Runtime } from "../../src/helper/adapter";
import type { Hono } from '../hono'
import type { BlankEnv, BlankSchema, Env, Handler, Input, MiddlewareHandler, Schema } from '../types'


type ContextExtensions = Record<string, any>;

export interface HonoPlugin<
  E extends Env = BlankEnv,
  P extends string = any,
  I extends Input = any,
  O extends Schema = BlankSchema
> {
  name: string;
  version: string;
  dependencies?: string[];
  runtimes?: Runtime[];

  install(app: Hono<E, O, P>, options?: Record<string, unknown>): void | Promise<void>;
  uninstall?(app: Hono<E, O, P>): void | Promise<void>;

  middleware?: MiddlewareHandler<E, P, I>[];
  routes?: Handler<E, P, I>[];
  contextExtensions?: ContextExtensions;
}
