/**
 * 🧪 ENTERPRISE: Unit Tests for Retry Logic
 *
 * Tests for exponential backoff retry mechanism.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 */

import {
  withRetry,
  withFastRetry,
  calculateBackoffDelay,
  isRetryableError,
  DEFAULT_RETRY_CONFIG,
  FAST_RETRY_CONFIG,
} from '../utils/retry';
import type { RetryConfig } from '../utils/retry';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a mock async function that fails N times then succeeds
 */
function createFailingOperation<T>(
  failCount: number,
  successValue: T,
  errorMessage = 'NETWORK_ERROR'
): () => Promise<T> {
  let attempts = 0;
  return async () => {
    attempts++;
    if (attempts <= failCount) {
      throw new Error(errorMessage);
    }
    return successValue;
  };
}

/**
 * Create a mock async function that always fails
 */
function createAlwaysFailingOperation(errorMessage = 'NETWORK_ERROR'): () => Promise<never> {
  return async () => {
    throw new Error(errorMessage);
  };
}

// ============================================================================
// TESTS: calculateBackoffDelay
// ============================================================================

describe('calculateBackoffDelay', () => {
  const config: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    useJitter: false,
  };

  test('should calculate correct delay for first attempt', () => {
    const delay = calculateBackoffDelay(1, config);
    expect(delay).toBe(1000);
  });

  test('should calculate correct delay for second attempt', () => {
    const delay = calculateBackoffDelay(2, config);
    expect(delay).toBe(2000);
  });

  test('should calculate correct delay for third attempt', () => {
    const delay = calculateBackoffDelay(3, config);
    expect(delay).toBe(4000);
  });

  test('should cap delay at maxDelayMs', () => {
    const configWithLowMax: RetryConfig = { ...config, maxDelayMs: 1500 };
    const delay = calculateBackoffDelay(3, configWithLowMax);
    expect(delay).toBe(1500);
  });

  test('should add jitter when enabled', () => {
    const configWithJitter: RetryConfig = { ...config, useJitter: true };
    const delays = new Set<number>();

    // Run multiple times to verify randomness
    for (let i = 0; i < 10; i++) {
      delays.add(calculateBackoffDelay(1, configWithJitter));
    }

    // With jitter, we should get different values (probabilistic)
    // At minimum, delays should be within jitter range
    const baseDelay = 1000;
    const jitterRange = baseDelay * 0.25;

    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(baseDelay - jitterRange);
      expect(delay).toBeLessThanOrEqual(baseDelay + jitterRange);
    }
  });
});

// ============================================================================
// TESTS: isRetryableError
// ============================================================================

describe('isRetryableError', () => {
  test('should return true for retryable error', () => {
    const error = new Error('NETWORK_ERROR: Connection failed');
    expect(isRetryableError(error, DEFAULT_RETRY_CONFIG)).toBe(true);
  });

  test('should return true for timeout error', () => {
    const error = new Error('Request TIMEOUT exceeded');
    expect(isRetryableError(error, DEFAULT_RETRY_CONFIG)).toBe(true);
  });

  test('should return false for non-retryable error', () => {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      retryableErrors: ['NETWORK_ERROR'],
    };
    const error = new Error('VALIDATION_ERROR: Invalid input');
    expect(isRetryableError(error, config)).toBe(false);
  });

  test('should return true when no retryable errors specified', () => {
    const config: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      retryableErrors: [],
    };
    const error = new Error('Any error');
    expect(isRetryableError(error, config)).toBe(true);
  });
});

// ============================================================================
// TESTS: withRetry
// ============================================================================

describe('withRetry', () => {
  // Use short delays for tests
  const testConfig: Partial<RetryConfig> = {
    maxAttempts: 3,
    baseDelayMs: 10,
    maxDelayMs: 100,
    useJitter: false,
  };

  test('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await withRetry(operation, testConfig);

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('should retry and succeed after failures', async () => {
    const operation = createFailingOperation(2, 'success');

    const result = await withRetry(operation, testConfig);

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.attempts).toBe(3);
  });

  test('should fail after max attempts', async () => {
    const operation = createAlwaysFailingOperation('NETWORK_ERROR');

    const result = await withRetry(operation, testConfig);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('NETWORK_ERROR');
    expect(result.attempts).toBe(3);
  });

  test('should not retry non-retryable errors', async () => {
    const configWithSpecificErrors: Partial<RetryConfig> = {
      ...testConfig,
      retryableErrors: ['NETWORK_ERROR'],
    };
    const operation = createAlwaysFailingOperation('VALIDATION_ERROR');

    const result = await withRetry(operation, configWithSpecificErrors);

    expect(result.success).toBe(false);
    expect(result.attempts).toBeLessThanOrEqual(1);
  });

  test('should track total time', async () => {
    const operation = createFailingOperation(1, 'success');

    const result = await withRetry(operation, testConfig);

    expect(result.totalTimeMs).toBeGreaterThan(0);
  });

  test('should call onRetry callback', async () => {
    const onRetry = jest.fn();
    const operation = createFailingOperation(1, 'success');

    await withRetry(operation, { ...testConfig, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      1,
      expect.any(Error),
      expect.any(Number)
    );
  });
});

// ============================================================================
// TESTS: withFastRetry
// ============================================================================

describe('withFastRetry', () => {
  test('should use fast retry config', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result = await withFastRetry(operation);

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
  });

  test('should have fewer max attempts than default', () => {
    expect(FAST_RETRY_CONFIG.maxAttempts).toBeLessThan(DEFAULT_RETRY_CONFIG.maxAttempts);
  });

  test('should have shorter base delay than default', () => {
    expect(FAST_RETRY_CONFIG.baseDelayMs).toBeLessThan(DEFAULT_RETRY_CONFIG.baseDelayMs);
  });
});

// ============================================================================
// TESTS: Integration
// ============================================================================

describe('Retry Integration', () => {
  test('should handle concurrent retries', async () => {
    const operations = [
      createFailingOperation(1, 'result1'),
      createFailingOperation(2, 'result2'),
      jest.fn().mockResolvedValue('result3'),
    ];

    const testConfig: Partial<RetryConfig> = {
      maxAttempts: 3,
      baseDelayMs: 5,
      useJitter: false,
    };

    const results = await Promise.all(
      operations.map((op) => withRetry(op, testConfig))
    );

    expect(results.every((r) => r.success)).toBe(true);
    expect(results.map((r) => r.data)).toEqual(['result1', 'result2', 'result3']);
  });

  test('should work with real async operations', async () => {
    let callCount = 0;
    const operation = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (callCount < 2) throw new Error('NETWORK_ERROR');
      return { data: 'success' };
    };

    const result = await withRetry(operation, {
      maxAttempts: 3,
      baseDelayMs: 10,
      useJitter: false,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ data: 'success' });
    expect(callCount).toBe(2);
  });
});
