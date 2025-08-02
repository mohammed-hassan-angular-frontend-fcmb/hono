// cli/commands/build.ts
import type { Runtime } from '../../src/helper/adapter'

interface BuildOptions {
  runtime: Runtime;
  minify?: boolean;
  sourceMap?: boolean;
  analyze?: boolean;
  outputDir?: string;
}
