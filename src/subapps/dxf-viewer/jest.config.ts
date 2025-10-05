import type { Config } from 'jest';

/**
 * 🏢 ENTERPRISE JEST CONFIGURATION για DXF Viewer
 * Comprehensive testing setup με coverage, reports και CI/CD integration
 */
const config: Config = {
  // Basic configuration
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/test/setupCanvas.ts',
    '<rootDir>/test/setupTests.ts'
  ],

  // Test discovery - includes property-based και visual regression tests
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/__tests__/**/*.prop.test.ts',  // 🎲 Property-based tests
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.prop.test.ts'                // 🎲 Property-based tests
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'debug/**/*.{ts,tsx}',
    'rendering/**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/*.d.ts',
    '!**/index.ts', // Index files συνήθως είναι re-exports
    '!**/__tests__/**',
    '!**/test/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'cobertura' // Για CI/CD integration
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Specific thresholds για critical modules
    './rendering/core/CoordinateTransforms.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  // Reporters για enterprise-level reporting
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'reports/junit',
        outputName: 'jest-junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        includeConsoleOutput: 'true',
        includeShortConsoleOutput: 'true'
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: 'reports/html',
        filename: 'test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'DXF Viewer Test Report',
        logoImgPath: undefined,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ]
  ],

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        // Override tsconfig για testing
        compilerOptions: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          // 🎲 Additional config για property-based tests
          target: 'ES2020',  // Modern JS για fast-check
          lib: ['ES2020', 'DOM'],
          types: ['jest', 'node']
        }
      },
      isolatedModules: true
    }
  },

  // 🎲 PROPERTY-BASED TEST SPECIFIC SETTINGS
  testRunner: 'jest-circus/runner', // Better για async property tests

  // Special test matching patterns για different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/__tests__/**/*.test.tsx',
        '**/*.test.ts',
        '**/*.test.tsx'
      ],
      testPathIgnorePatterns: [
        '**/*visual-regression*',
        '**/*.prop.test.ts'
      ],
      testTimeout: 30000
    },
    {
      displayName: 'property-based',
      testMatch: [
        '**/__tests__/**/*.prop.test.ts',
        '**/*.prop.test.ts'
      ],
      testTimeout: 120000, // Longer timeout για property tests
      // 🎯 Property-based tests may need more time
    },
    {
      displayName: 'visual-regression',
      testMatch: [
        '**/__tests__/**/visual-regression.test.ts',
        '**/*visual-regression*.test.ts'
      ],
      testTimeout: 180000, // 3 minutes για visual comparison tests
      setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'],
      // 🎨 Visual regression tests need more time για image processing
    }
  ],

  // Module resolution
  moduleNameMapping: {
    // Path mapping για cleaner imports στα tests
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@debug/(.*)$': '<rootDir>/debug/$1',
    '^@rendering/(.*)$': '<rootDir>/rendering/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(module-that-needs-to-be-transformed)/)'
  ],

  // Performance και timeout settings
  testTimeout: 60000, // 60s για property-based tests (μπορεί να είναι slower)
  maxWorkers: '50%', // Use half of available cores για CI efficiency

  // 🎲 PROPERTY-BASED TEST CONFIGURATION
  // Special handling για fast-check tests
  testEnvironmentOptions: {
    // Increase memory για property-based testing
    // fast-check may generate many test cases
  },

  // Verbose output για detailed testing feedback
  verbose: true,
  silent: false,

  // Cache configuration για faster subsequent runs
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Error handling
  errorOnDeprecated: true,
  bail: false, // Continue running tests even if some fail

  // Watch mode configuration (for development)
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/reports/',
    '<rootDir>/test/baselines/' // Visual regression baselines
  ],

  // Custom environment variables για tests
  setupFiles: [],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true
};

export default config;