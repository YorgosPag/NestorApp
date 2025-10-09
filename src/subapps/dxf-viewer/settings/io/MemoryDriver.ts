/**
 * @file Memory Driver Implementation
 * @module settings/io/MemoryDriver
 *
 * ENTERPRISE STANDARD - In-memory storage driver
 *
 * **USE CASE:**
 * - Unit testing (no real storage needed)
 * - SSR (no browser storage available)
 * - Temporary/session-only storage
 *
 *  - Module #4
 */

import type { StorageDriver } from './StorageDriver';

// ============================================================================
// MEMORY DRIVER
// ============================================================================

export class MemoryDriver implements StorageDriver {
  private storage: Map<string, unknown>;

  constructor() {
    this.storage = new Map();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  async get<T>(key: string): Promise<T | null> {
    const value = this.storage.get(key);
    return value !== undefined ? (value as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  // ==========================================================================
  // TESTING UTILITIES
  // ==========================================================================

  /**
   * Get raw storage map (for testing/debugging)
   */
  getRawStorage(): Map<string, unknown> {
    return this.storage;
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.size;
  }
}
