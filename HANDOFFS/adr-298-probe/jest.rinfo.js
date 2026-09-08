module.exports = {
  testEnvironment: 'node',
  rootDir: 'C:/Nestor_Pagonis/HANDOFFS/adr-298-probe',
  testMatch: ['<rootDir>/reason-info.test.ts'],
  moduleDirectories: ['node_modules', 'C:/Nestor_Pagonis/node_modules'],
  transform: { '^.+\.(t|j)sx?$': ['C:/Nestor_Pagonis/node_modules/@swc/jest', { jsc: { parser: { syntax: 'typescript', tsx: false, decorators: true }, target: 'es2022' } }] },
  maxWorkers: 1,
};
