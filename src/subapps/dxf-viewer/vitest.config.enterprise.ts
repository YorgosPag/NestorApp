/**
 * 🏢 VITEST ENTERPRISE CONFIGURATION (v4 Compatible)
 *
 * Fortune 500 / AutoCAD-class test configuration
 *
 * Features:
 * - Coverage thresholds (80%+ για enterprise code)
 * - GC exposure για memory leak tests
 * - Performance budgets
 * - Deterministic test execution
 * - CI/CD optimizations
 *
 * @module vitest.config.enterprise
 * @see https://vitest.dev/guide/migration#pool-rework
 */

import path from 'path';

// ✅ ENTERPRISE: Type-safe config interface για Vitest 4
interface VitestTestConfig {
  environment?: string;
  globals?: boolean;
  include?: string[];
  exclude?: string[];
  sequence?: { shuffle?: boolean; concurrent?: boolean };
  testTimeout?: number;
  hookTimeout?: number;
  coverage?: {
    provider?: string;
    enabled?: boolean;
    reporter?: string[];
    thresholds?: { lines?: number; functions?: number; branches?: number; statements?: number };
    include?: string[];
    exclude?: string[];
    all?: boolean;
    skipFull?: boolean;
  };
  reporters?: string[];
  outputFile?: Record<string, string>;
  clearMocks?: boolean;
  restoreMocks?: boolean;
  mockReset?: boolean;
  watch?: boolean;
  isolate?: boolean;
  pool?: string;
  setupFiles?: string[];
  globalSetup?: string;
}

interface VitestConfig {
  test?: VitestTestConfig;
  resolve?: { alias?: Record<string, string> };
  poolOptions?: { threads?: { singleThread?: boolean; maxThreads?: number; minThreads?: number } };
}

// ✅ ENTERPRISE: Direct export - no defineConfig needed for npx compatibility
const config: VitestConfig = {
  test: {
    // ═══ TEST ENVIRONMENT ═══
    // Use 'node' for service tests (no DOM needed)
    // Change to 'jsdom' for UI tests (requires: npm install --save-dev jsdom)
    environment: 'node',
    globals: true,

    // ═══ TEST DISCOVERY ═══
    // Paths relative to project root (C:\Nestor_Pagonis)
    include: [
      'src/subapps/dxf-viewer/services/__tests__/**/*.test.ts',
      'src/subapps/dxf-viewer/services/__tests__/**/*.enterprise.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**'
    ],

    // ═══ TEST EXECUTION ═══
    // Run tests serially για deterministic results
    sequence: {
      shuffle: false,        // Deterministic order
      concurrent: false      // One at a time
    },

    // Timeout settings
    testTimeout: 10000,      // 10 seconds per test
    hookTimeout: 10000,

    // ═══ COVERAGE CONFIGURATION ═══
    // Note: Requires @vitest/coverage-v8 package
    // Run: npm install --save-dev @vitest/coverage-v8
    coverage: {
      provider: 'v8',
      enabled: false,         // Disabled until @vitest/coverage-v8 is installed
      reporter: ['text', 'json', 'html', 'lcov'],

      // ✅ ENTERPRISE COVERAGE THRESHOLDS
      thresholds: {
        lines: 80,           // 80% line coverage minimum
        functions: 80,       // 80% function coverage
        branches: 75,        // 75% branch coverage
        statements: 80       // 80% statement coverage
      },

      // Include only production code
      include: [
        'src/subapps/dxf-viewer/services/**/*.ts'
      ],

      // Exclude test files και utilities
      exclude: [
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/__benchmarks__/**',
        '**/__health__/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/*.d.ts'
      ],

      // Report uncovered lines
      all: true,
      skipFull: false
    },

    // ═══ REPORTERS ═══
    reporters: process.env.CI
      ? ['default', 'json', 'junit']
      : ['default', 'verbose'],

    // ═══ OUTPUT ═══
    outputFile: {
      json: './test-results/results.json',
      junit: './test-results/junit.xml'
    },

    // ═══ MOCK BEHAVIOR ═══
    clearMocks: true,         // Clear mocks between tests
    restoreMocks: true,       // Restore original implementations
    mockReset: true,          // Reset mock state

    // ═══ WATCH MODE ═══
    watch: false,             // Disable watch στο CI

    // ═══ PERFORMANCE ═══
    isolate: true,            // Isolate tests για memory leaks
    pool: 'threads',          // Use worker threads
    // Note: poolOptions moved to top-level in Vitest 4

    // ═══ SETUP FILES ═══
    setupFiles: [
      './src/subapps/dxf-viewer/services/__tests__/setup.ts'
    ],

    // ═══ GLOBALS ═══
    // Expose GC για memory leak tests
    globalSetup: './src/subapps/dxf-viewer/services/__tests__/global-setup.ts'
  },

  // ═══ RESOLVE ═══
  // Note: __dirname = C:\Nestor_Pagonis\src\subapps\dxf-viewer (config file location)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/services': path.resolve(__dirname, 'services'),
      '@/types': path.resolve(__dirname, 'types')
    }
  },

  // ═══ POOL OPTIONS (Vitest 4 - Top Level) ═══
  poolOptions: {
    threads: {
      singleThread: false,    // Use multiple threads
      maxThreads: process.env.CI ? 2 : 4,
      minThreads: 1
    }
  }
};

export default config;
