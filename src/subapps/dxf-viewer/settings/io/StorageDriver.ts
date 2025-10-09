/**
 * @file Storage Driver Interface
 * @module settings/io/StorageDriver
 *
 * ENTERPRISE STANDARD - Storage abstraction layer
 *
 * CRITICAL FIX: Eliminates direct localStorage calls scattered across codebase
 * Previously: 30+ direct window.localStorage calls
 * Now: Abstraction with multiple backends (IndexedDB, localStorage, memory)
 *
 *  - Module #4
 */

// ============================================================================
// STORAGE DRIVER INTERFACE
// ============================================================================

/**
 * Abstract storage interface
 *
 * Implementations:
 * - IndexedDbDriver (primary) - Structured storage with versioned schema
 * - LocalStorageDriver (fallback) - Simple key-value storage
 * - MemoryDriver (testing/SSR) - In-memory storage for tests
 *
 * **ENTERPRISE PATTERN:**
 * - Async API (supports both sync and async backends)
 * - Type-safe (generic T for stored values)
 * - Error handling (never throws, returns null on error)
 * - SSR-safe (no direct window access)
 */
export interface StorageDriver {
  /**
   * Get value by key
   *
   * @param key - Storage key
   * @returns Stored value or null if not found/error
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set value by key
   *
   * @param key - Storage key
   * @param value - Value to store
   * @throws Never throws - logs errors internally
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Delete value by key
   *
   * @param key - Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * Get all keys
   *
   * @returns Array of all storage keys
   */
  keys(): Promise<string[]>;

  /**
   * Clear all data
   *
   * **WARNING:** Destructive operation!
   */
  clear(): Promise<void>;

  /**
   * Check if storage is available
   *
   * @returns True if storage backend is functional
   */
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// STORAGE POLICY
// ============================================================================

/**
 * Storage backend selection policy
 */
export enum StoragePolicy {
  /**
   * Prefer IndexedDB, fallback to localStorage
   * (Recommended for production)
   */
  PREFER_INDEXED_DB = 'prefer_indexed_db',

  /**
   * Force localStorage only
   * (Use for simple apps or debugging)
   */
  FORCE_LOCAL_STORAGE = 'force_local_storage',

  /**
   * Force memory only (no persistence)
   * (Use for testing or SSR)
   */
  FORCE_MEMORY = 'force_memory'
}

// ============================================================================
// STORAGE ERROR TYPES
// ============================================================================

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageQuotaError extends StorageError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'StorageQuotaError';
  }
}

export class StorageUnavailableError extends StorageError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'StorageUnavailableError';
  }
}
