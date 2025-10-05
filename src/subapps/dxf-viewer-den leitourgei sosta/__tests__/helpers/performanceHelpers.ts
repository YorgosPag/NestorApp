/**
 * 🎯 PERFORMANCE HELPERS - Centralized Performance Testing Utilities
 *
 * Single source of truth για performance-related test utilities.
 * Περιλαμβάνει timing, benchmarking, και performance assertions.
 *
 * @module __tests__/helpers/performanceHelpers
 */

/**
 * 🎯 TEST RESULT - Type για test results
 */
export interface TestResult {
  category: string;
  test: string;
  status: 'success' | 'failed' | 'warning';
  message: string;
  details?: any;
  durationMs: number;
}

/**
 * 🎯 SLEEP - Utility για async delays
 *
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>} Promise που resolves μετά από ms
 *
 * @example
 * ```typescript
 * await sleep(1000); // Wait 1 second
 * ```
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * 🎯 MEASURE TEST - Measure test duration and capture result
 *
 * Centralized utility για measuring test performance.
 * Χρησιμοποιείται στα enterprise tests (grid-enterprise-test.ts, etc.)
 *
 * @param {string} category - Test category (e.g., "MORPHOLOGIC", "SYNTACTIC")
 * @param {string} test - Test name
 * @param {Function} fn - Test function που επιστρέφει Promise με result
 * @returns {Promise<TestResult>} Test result με duration
 *
 * @example
 * ```typescript
 * const result = await measureTest('MORPHOLOGIC', 'Grid Context', async () => {
 *   const context = getGridContext();
 *   return {
 *     status: context ? 'success' : 'failed',
 *     message: context ? 'Grid context exists' : 'No grid context'
 *   };
 * });
 * console.log(`Test completed in ${result.durationMs}ms`);
 * ```
 */
export const measureTest = async (
  category: string,
  test: string,
  fn: () => Promise<{ status: 'success' | 'failed' | 'warning'; message: string; details?: any }>
): Promise<TestResult> => {
  const startTime = performance.now();

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - startTime);

    return {
      category,
      test,
      status: result.status,
      message: result.message,
      details: result.details,
      durationMs
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);

    return {
      category,
      test,
      status: 'failed',
      message: err.message || 'Unknown error',
      details: err.stack,
      durationMs
    };
  }
};

/**
 * 🎯 BENCHMARK - Run function multiple times and measure performance
 *
 * @param {Function} fn - Function to benchmark
 * @param {number} iterations - Number of iterations (default: 1000)
 * @returns {Object} Benchmark results
 *
 * @example
 * ```typescript
 * const results = benchmark(() => {
 *   // Code to benchmark
 *   calculateCoordinates(100, 200);
 * }, 1000);
 *
 * console.log(`Avg: ${results.avgMs}ms, Total: ${results.totalMs}ms`);
 * ```
 */
export const benchmark = (fn: () => void, iterations: number = 1000) => {
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    fn();
  }

  const endTime = performance.now();
  const totalMs = endTime - startTime;
  const avgMs = totalMs / iterations;
  const opsPerSecond = Math.round((iterations / totalMs) * 1000);

  return {
    iterations,
    totalMs: Math.round(totalMs),
    avgMs: Number(avgMs.toFixed(3)),
    opsPerSecond
  };
};

/**
 * 🎯 MEASURE ASYNC - Measure async function duration
 *
 * @param {Function} fn - Async function to measure
 * @returns {Promise<Object>} Result με duration
 *
 * @example
 * ```typescript
 * const { result, durationMs } = await measureAsync(async () => {
 *   return await fetchData();
 * });
 * console.log(`Fetched data in ${durationMs}ms`);
 * ```
 */
export const measureAsync = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> => {
  const startTime = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - startTime);

  return { result, durationMs };
};

/**
 * 🎯 ASSERT PERFORMANCE - Assert function completes within budget
 *
 * @param {Function} fn - Function to measure
 * @param {number} budgetMs - Performance budget σε ms
 * @param {string} description - Test description
 * @throws {Error} If performance budget exceeded
 *
 * @example
 * ```typescript
 * await assertPerformance(
 *   async () => {
 *     await renderCanvas();
 *   },
 *   100,
 *   'Canvas rendering'
 * );
 * // Throws if rendering takes > 100ms
 * ```
 */
export const assertPerformance = async (
  fn: () => Promise<void>,
  budgetMs: number,
  description: string
): Promise<void> => {
  const { durationMs } = await measureAsync(fn);

  if (durationMs > budgetMs) {
    throw new Error(
      `Performance budget exceeded for "${description}": ${durationMs}ms > ${budgetMs}ms`
    );
  }
};

/**
 * 🎯 MEASURE MEMORY - Measure memory usage (if available)
 *
 * @returns {Object | null} Memory usage ή null if not available
 *
 * @example
 * ```typescript
 * const before = measureMemory();
 * // ... do something
 * const after = measureMemory();
 * const delta = after.usedJSHeapSize - before.usedJSHeapSize;
 * console.log(`Memory increase: ${delta} bytes`);
 * ```
 */
export const measureMemory = (): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null => {
  if (
    typeof performance !== 'undefined' &&
    'memory' in performance &&
    performance.memory
  ) {
    const mem = performance.memory as any;
    return {
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
      jsHeapSizeLimit: mem.jsHeapSizeLimit
    };
  }
  return null;
};

/**
 * 🎯 WAIT WITH TIMEOUT - Wait με timeout
 *
 * @param {Function} condition - Condition function που επιστρέφει boolean
 * @param {number} timeout - Timeout σε ms (default: 5000)
 * @param {number} interval - Check interval σε ms (default: 100)
 * @returns {Promise<void>} Resolves όταν condition = true
 * @throws {Error} If timeout
 *
 * @example
 * ```typescript
 * await waitWithTimeout(
 *   () => document.querySelector('.loaded') !== null,
 *   5000,
 *   100
 * );
 * // Wait μέχρι το element να εμφανιστεί
 * ```
 */
export const waitWithTimeout = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime >= timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await sleep(interval);
  }
};

/**
 * 🎯 PROFILE - Profile function execution με detailed metrics
 *
 * @param {Function} fn - Function to profile
 * @param {string} label - Profile label
 * @returns {Promise<Object>} Profile results
 *
 * @example
 * ```typescript
 * const profile = await profileExecution(async () => {
 *   await processData();
 * }, 'Data Processing');
 *
 * console.log(profile);
 * // {
 * //   label: 'Data Processing',
 * //   durationMs: 150,
 * //   memoryDelta: 1024000,
 * //   timestamp: 1234567890
 * // }
 * ```
 */
export const profileExecution = async <T>(
  fn: () => Promise<T>,
  label: string
): Promise<{
  label: string;
  result: T;
  durationMs: number;
  memoryDelta: number | null;
  timestamp: number;
}> => {
  const memBefore = measureMemory();
  const startTime = performance.now();
  const timestamp = Date.now();

  const result = await fn();

  const durationMs = Math.round(performance.now() - startTime);
  const memAfter = measureMemory();

  const memoryDelta =
    memBefore && memAfter
      ? memAfter.usedJSHeapSize - memBefore.usedJSHeapSize
      : null;

  return {
    label,
    result,
    durationMs,
    memoryDelta,
    timestamp
  };
};
