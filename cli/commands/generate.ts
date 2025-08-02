// cli/commands/generate.ts
import type { Runtime } from "../../src/helper/adapter";

interface GenerateOptions {
  type: 'middleware' | 'handler' | 'route-group' | 'test';
  name: string;
  template?: string;
  typescript?: boolean;
  runtime?: Runtime;
}
