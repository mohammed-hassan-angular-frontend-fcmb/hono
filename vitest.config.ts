/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  resolve: {
    alias: {
      'hono': resolve(__dirname, './src/index.ts'),
      'hono/factory': resolve(__dirname, './src/factory.ts'),
      'hono/context': resolve(__dirname, './src/context.ts')
    }
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: __dirname + '/../src/jsx',
  },
  test: {
    globals: true,
    include: [
      '**/src/**/(*.)+(spec|test).+(ts|tsx|js)',
      '**/scripts/**/(*.)+(spec|test).+(ts|tsx|js)',
      '**/build/**/(*.)+(spec|test).+(ts|tsx|js)',
      '**/tests/**/(*.)+(spec|test).+(ts|tsx|js)'
    ],
    exclude: [...configDefaults.exclude, '**/sandbox/**', '**/*.case.test.+(ts|tsx|js)'],
    setupFiles: ['./.vitest.config/setup-vitest.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage/raw/default',
      reporter: ['json', 'text', 'html'],
      exclude: [
        ...(configDefaults.coverage.exclude ?? []),
        'benchmarks',
        'runtime-tests',
        'build/build.ts',
        'src/test-utils',
        'perf-measures',

        // types are compile-time only, so their coverage cannot be measured
        'src/**/types.ts',
        'src/jsx/intrinsic-elements.ts',
        'src/utils/http-status.ts',
      ],
    },
    pool: 'forks',
  },
})


// // vitest.config.ts
// import { defineConfig } from 'vitest/config'

// export default defineConfig({
//   test: {
//     // Test environment
//     environment: 'node',

//     // Global test setup
//     setupFiles: ['./tests/setup/test-environment.ts'],

//     // Coverage configuration for Test Coverage Analysis
//     coverage: {
//       provider: 'v8', // or 'istanbul'
//       reporter: ['text', 'text-summary', 'html', 'lcov', 'json'],
//       reportsDirectory: './coverage',

//       // Coverage thresholds matching your implementation
//       thresholds: {
//         global: {
//           statements: 90,
//           branches: 85,
//           functions: 90,
//           lines: 90
//         },
//         // Per-directory thresholds as shown in your report
//         'src/security/': {
//           statements: 95,
//           branches: 92,
//           functions: 97,
//           lines: 95
//         },
//         'src/observability/': {
//           statements: 93,
//           branches: 89,
//           functions: 94,
//           lines: 93
//         },
//         'src/router/': {
//           statements: 94,
//           branches: 93,
//           functions: 96,
//           lines: 94
//         }
//       },

//       // Include/exclude patterns
//       include: ['src/**/*.ts'],
//       exclude: [
//         '**/*.test.ts',
//         '**/*.spec.ts',
//         '**/test-helpers.ts',
//         '**/mock-*.ts',
//         '**/*.d.ts',
//         'src/types/**',
//         'coverage/**',
//         'dist/**'
//       ],

//       // Additional coverage options
//       all: true,
//       skipFull: false,
//       clean: true
//     },

//     // Test file patterns
//     include: [
//       'tests/**/*.test.ts',
//       'tests/**/*.spec.ts'
//     ],

//     // Test exclusions
//     exclude: [
//       'node_modules/**',
//       'dist/**',
//       'coverage/**'
//     ],

//     // Performance testing configuration
//     testTimeout: 30000, // 30s for performance tests
//     hookTimeout: 10000,

//     // Reporters for different output formats
//     reporters: ['verbose', 'json', 'html'],

//     // Globals (if you prefer not to import describe/it/expect)
//     globals: true,

//     // Pool options for parallel execution
//     pool: 'threads',
//     poolOptions: {
//       threads: {
//         singleThread: false,
//         maxThreads: 4,
//         minThreads: 1
//       }
//     },

//     // Benchmark configuration for performance tests
//     benchmark: {
//       include: ['tests/performance/**/*.bench.ts'],
//       reporters: ['verbose']
//     }
//   },

//   // Resolve configuration
//   resolve: {
//     alias: {
//       '@': '/src',
//       '@tests': '/tests'
//     }
//   }
// })
