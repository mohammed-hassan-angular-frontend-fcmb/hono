// cli/commands/dev.ts
import type { Runtime } from '../../src/helper/adapter'

interface DevServerOptions {
  port?: number;
  runtime: Runtime;
  hotReload?: boolean;
  watchPaths?: string[];
  envFile?: string;
}
