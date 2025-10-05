/**
 * 🧪 JEST GLOBALS TYPE DECLARATIONS
 * Provides TypeScript support για Jest globals in test files
 */

declare global {
  interface TestFunction {
    (name: string, fn: () => void | Promise<void>): void;
    each<T>(cases: T[]): (name: string, fn: (testCase: T) => void | Promise<void>) => void;
  }

  interface DescribeFunction {
    (name: string, fn: () => void): void;
    each<T>(cases: T[]): (name: string, fn: (testCase: T) => void) => void;
  }

  var describe: DescribeFunction;
  var test: TestFunction;
  var expect: (actual: any) => any;
  var beforeAll: (fn: () => void | Promise<void>) => void;
  var afterAll: (fn: () => void | Promise<void>) => void;
  var beforeEach: (fn: () => void | Promise<void>) => void;
  var afterEach: (fn: () => void | Promise<void>) => void;
  var it: TestFunction;
  var jest: any;

  namespace jest {
    interface Matchers<R> {
      toBe(expected: any): R;
      toEqual(expected: any): R;
      toBeTruthy(): R;
      toBeFalsy(): R;
      toBeUndefined(): R;
      toBeDefined(): R;
      toBeNull(): R;
      toBeGreaterThan(expected: number): R;
      toBeLessThan(expected: number): R;
      toBeGreaterThanOrEqual(expected: number): R;
      toBeLessThanOrEqual(expected: number): R;
      toContain(expected: any): R;
      toMatch(expected: string | RegExp): R;
      toThrow(expected?: string | RegExp | Error): R;
    }
  }
}

export {};