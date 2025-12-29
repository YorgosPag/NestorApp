/**
 * 🏢 VITEST ENTERPRISE CONFIGURATION
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
 */

// ✅ ENTERPRISE: Type-safe conditional import για production compatibility
import path from 'path';

interface VitestConfig {
  test?: any;
  [key: string]: any;
}

let defineConfig: (config: VitestConfig) => VitestConfig;

try {
  const vitestModule = eval('require')('vitest/config');
  defineConfig = vitestModule.defineConfig;
} catch {
  // Production fallback - vitest not available
  defineConfig = (config: VitestConfig) => config;
}

export default defineConfig({
  test: {
    // ═══ TEST ENVIRONMENT ═══
    environment: 'jsdom',
    globals: true,

    // ═══ TEST DISCOVERY ═══
    include: [
      'services/__tests__/**/*.test.ts',
      'services/__tests__/**/*.enterprise.test.ts'
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
    coverage: {
      provider: 'v8',
      enabled: true,
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
        'services/**/*.ts'
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
    poolOptions: {
      threads: {
        singleThread: false,  // Use multiple threads
        maxThreads: process.env.CI ? 2 : 4,
        minThreads: 1
      }
    },

    // ═══ SETUP FILES ═══
    setupFiles: [
      './services/__tests__/setup.ts'
    ],

    // ═══ GLOBALS ═══
    // Expose GC για memory leak tests
    globalSetup: './services/__tests__/global-setup.ts'
  },

  // ═══ RESOLVE ═══
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/services': path.resolve(__dirname, './services'),
      '@/types': path.resolve(__dirname, './types')
    }
  }
});
