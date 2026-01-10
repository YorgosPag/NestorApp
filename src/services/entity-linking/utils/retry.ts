/**
 * 🏢 ENTERPRISE: Retry Logic with Exponential Backoff
 *
 * Industry-standard retry mechanism following AWS, Google Cloud, and Bentley patterns.
 * Implements exponential backoff with jitter to prevent thundering herd problem.
 *
 * @author Claude AI Assistant
 * @created 2026-01-07
 * @pattern Exponential Backoff with Jitter (AWS Best Practices)
 *
 * @example
 * ```typescript
 * import { withRetry, RetryConfig } from './retry';
 *
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxAttempts: 3, baseDelayMs: 1000 }
 * );
 * ```
 */

// ============================================================================
// 🏢 ENTERPRISE: Configuration Types
// ============================================================================

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  readonly maxAttempts: number;
  /** Base delay in milliseconds (default: 1000) */
  readonly baseDelayMs: number;
  /** Maximum delay in milliseconds (default: 30000) */
  readonly maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  readonly backoffMultiplier: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  readonly useJitter: boolean;
  /** Errors that should trigger retry (default: all errors) */
  readonly retryableErrors?: ReadonlyArray<string>;
  /** Callback for each retry attempt */
  readonly onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: Error;
  readonly attempts: number;
  readonly totalTimeMs: number;
}

// ============================================================================
// 🏢 ENTERPRISE: Default Configuration
// ============================================================================

/**
 * Enterprise-standard retry configuration
 * Based on AWS SDK and Google Cloud best practices
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  useJitter: true,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVICE_UNAVAILABLE',
    'TOO_MANY_REQUESTS',
    'INTERNAL_ERROR',
  ],
} as const;

/**
 * Fast retry configuration for UI operations
 */
export const FAST_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  useJitter: true,
} as const;

/**
 * Aggressive retry configuration for critical operations
 */
export const AGGRESSIVE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  useJitter: true,
} as const;

// ============================================================================
// 🏢 ENTERPRISE: Core Retry Logic
// ============================================================================

/**
 * Calculate delay with exponential backoff and optional jitter
 *
 * @param attempt - Current attempt number (1-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  // Calculate exponential delay: baseDelay * (multiplier ^ (attempt - 1))
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter if enabled (±25% randomization)
  if (config.useJitter) {
    const jitterRange = cappedDelay * 0.25;
    const jitter = Math.random() * jitterRange * 2 - jitterRange;
    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  return Math.round(cappedDelay);
}

/**
 * Check if an error is retryable
 *
 * @param error - The error to check
 * @param config - Retry configuration
 * @returns Whether the error should trigger a retry
 */
export function isRetryableError(error: Error, config: RetryConfig): boolean {
  // If no specific retryable errors defined, retry all
  if (!config.retryableErrors || config.retryableErrors.length === 0) {
    return true;
  }

  const errorMessage = error.message.toUpperCase();
  const errorName = error.name.toUpperCase();

  return config.retryableErrors.some((retryableError) => {
    const pattern = retryableError.toUpperCase();
    return errorMessage.includes(pattern) || errorName.includes(pattern);
  });
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 🔄 Execute an async operation with retry logic
 *
 * Industry-standard retry mechanism with:
 * - Exponential backoff
 * - Jitter to prevent thundering herd
 * - Configurable retry conditions
 * - Detailed result reporting
 *
 * @param operation - The async operation to execute
 * @param config - Optional retry configuration (uses defaults if not provided)
 * @returns Promise with retry result
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error('NETWORK_ERROR');
 *     return response.json();
 *   },
 *   { maxAttempts: 3 }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts');
 * }
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;
  let actualAttempts = 0;

  for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
    actualAttempts = attempt;
    try {
      const data = await operation();

      console.log(
        `✅ [Retry] Operation succeeded on attempt ${attempt}/${fullConfig.maxAttempts}`
      );

      return {
        success: true,
        data,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.warn(
        `⚠️ [Retry] Attempt ${attempt}/${fullConfig.maxAttempts} failed:`,
        lastError.message
      );

      // Check if this is the last attempt
      if (attempt === fullConfig.maxAttempts) {
        console.error(`❌ [Retry] All ${fullConfig.maxAttempts} attempts exhausted`);
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(lastError, fullConfig)) {
        console.error(`❌ [Retry] Non-retryable error:`, lastError.message);
        break;
      }

      // Calculate delay for next attempt
      const delayMs = calculateBackoffDelay(attempt, fullConfig);

      // Call onRetry callback if provided
      if (fullConfig.onRetry) {
        fullConfig.onRetry(attempt, lastError, delayMs);
      }

      console.log(`⏳ [Retry] Waiting ${delayMs}ms before attempt ${attempt + 1}...`);

      // Wait before next attempt
      await sleep(delayMs);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: actualAttempts,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * 🔄 Decorator for adding retry logic to class methods
 *
 * @param config - Retry configuration
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class MyService {
 *   @Retryable({ maxAttempts: 3 })
 *   async fetchData(): Promise<Data> {
 *     return await fetch('/api/data').then(r => r.json());
 *   }
 * }
 * ```
 */
export function Retryable(config: Partial<RetryConfig> = {}) {
  return function <T>(
    _target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<T>>
  ): TypedPropertyDescriptor<(...args: unknown[]) => Promise<T>> {
    const originalMethod = descriptor.value;

    if (!originalMethod) {
      return descriptor;
    }

    descriptor.value = async function (...args: unknown[]): Promise<T> {
      const result = await withRetry(() => originalMethod.apply(this, args), config);

      if (result.success && result.data !== undefined) {
        return result.data;
      }

      throw result.error || new Error(`${propertyKey} failed after ${result.attempts} attempts`);
    };

    return descriptor;
  };
}

// ============================================================================
// 🏢 ENTERPRISE: Specialized Retry Functions
// ============================================================================

/**
 * Retry with fast configuration for UI operations
 */
export async function withFastRetry<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
  return withRetry(operation, FAST_RETRY_CONFIG);
}

/**
 * Retry with aggressive configuration for critical operations
 */
export async function withAggressiveRetry<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
  return withRetry(operation, AGGRESSIVE_RETRY_CONFIG);
}

/**
 * Retry specifically for Firestore operations
 */
export async function withFirestoreRetry<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
  return withRetry(operation, {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    useJitter: true,
    retryableErrors: [
      'UNAVAILABLE',
      'DEADLINE_EXCEEDED',
      'RESOURCE_EXHAUSTED',
      'INTERNAL',
      'NETWORK_ERROR',
    ],
  });
}
