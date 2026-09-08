module.exports = {
  displayName: 'rules-probe',
  testEnvironment: 'node',
  rootDir: 'C:/Nestor_Pagonis',
  testMatch: ['<rootDir>/tests/firestore-rules/suites/**/*.rules.test.ts'],
  moduleNameMapper: {
    '^\.\./_registry/coverage-manifest$':
      'C:/Nestor_Pagonis/HANDOFFS/adr-298-probe/manifest-shim.ts',
  },
  transform: { '^.+\.(t|j)sx?$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', tsx: false, decorators: true }, target: 'es2022' } }] },
  testTimeout: 30000,
  maxWorkers: 1,
};
