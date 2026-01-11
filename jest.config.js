/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '\\.spec\\.(ts|tsx|js|jsx)$',
    'visual-cross-browser'
  ],
  moduleNameMapper: {
    // Monorepo workspace packages
    '^@geo-alert/core$': '<rootDir>/packages/core/index.ts',
    // Path aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@subapps/(.*)$': '<rootDir>/src/subapps/$1',
    // Asset mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileStub.js'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    // 🏢 ENTERPRISE: Excluded from coverage (non-production code)
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
    '!src/app/**',
    '!**/node_modules/**',
    '!**/.next/**',
    // 🔧 Config files - no logic to test
    '!src/config/**',
    '!src/**/config.ts',
    '!src/**/*-config.ts',
    '!src/**/constants.ts',
    // 🧪 Test utilities and mocks
    '!src/**/__mocks__/**',
    '!src/**/__tests__/**',
    '!src/**/test-utils/**',
    '!src/**/testing/**',
    // 🎨 UI-only components (tested via E2E)
    '!src/components/ui/**',
    '!src/styles/**',
    // 🔌 Server/API routes (tested via integration)
    '!src/server/**',
    '!src/app/api/**'
  ],
  // 🏢 ENTERPRISE: Coverage thresholds
  // Phase 1: 0% (current) → Phase 2: 30% → Phase 3: 60%
  // TODO: Increase thresholds as test coverage improves
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: true
        },
        transform: {
          react: {
            runtime: 'automatic'
          }
        }
      }
    }]
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  testTimeout: 10000,
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};

module.exports = config;