/**
 * IndexedDB Driver Utilities
 *
 * Configuration, types, retry logic, and validation helpers for IndexedDbDriver.
 * Extracted per ADR-065 (file size compliance).
 *
 * @module settings/io/indexed-db-utils
 */

import { sleep } from '@/lib/async-utils';
import { StorageError, StorageQuotaError } from './StorageDriver';
import { validateSettingsState } from './schema';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface IndexedDbConfig {
  dbName: string;
  version: number;
  storeName: string;
  retryAttempts: number;
  retryDelay: number;
  telemetry: boolean;
  quotaWarningThreshold: number;
}

export const DEFAULT_CONFIG: IndexedDbConfig = {
  dbName: 'dxf_settings_db',
  version: 1,
  storeName: 'settings',
  retryAttempts: 3,
  retryDelay: 100,
  telemetry: true,
  quotaWarningThreshold: 80
};

// ============================================================================
// TELEMETRY
// ============================================================================

export interface IndexedDbMetrics {
  reads: number;
  writes: number;
  deletes: number;
  errors: number;
  transactionFailures: number;
  totalLatency: number;
  quotaUsage: number;
  quotaLimit: number;
}

export function createInitialMetrics(): IndexedDbMetrics {
  return {
    reads: 0,
    writes: 0,
    deletes: 0,
    errors: 0,
    transactionFailures: 0,
    totalLatency: 0,
    quotaUsage: 0,
    quotaLimit: 0
  };
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

export async function retryOperation<T>(
  operation: () => Promise<T>,
  config: IndexedDbConfig,
  attempt = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= config.retryAttempts - 1) {
      throw error;
    }

    if (error instanceof StorageQuotaError) {
      throw error;
    }

    const delay = config.retryDelay * Math.pow(2, attempt);
    await sleep(delay);

    return retryOperation(operation, config, attempt + 1);
  }
}

// ============================================================================
// VALIDATION & ERROR HELPERS
// ============================================================================

export function isQuotaExceeded(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error && 'name' in error) {
    return error.name === 'QuotaExceededError';
  }
  return false;
}

export function validateWriteData<T>(data: T): void {
  if (data === null || data === undefined) {
    throw new StorageError('Invalid data: null or undefined');
  }

  if (typeof data === 'object' && data !== null && '__standards_version' in data) {
    const validationResult = validateSettingsState(data);

    if (!validationResult.success) {
      const errors = 'error' in validationResult ? validationResult.error.errors : [];
      const errorMsg = errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');

      throw new StorageError(`Schema validation failed: ${errorMsg}`);
    }
  }
}
