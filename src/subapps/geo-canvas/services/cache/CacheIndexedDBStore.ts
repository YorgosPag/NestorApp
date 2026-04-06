/**
 * CACHE INDEXEDDB STORE
 *
 * IndexedDB persistence layer for the cache system
 * Handles all IndexedDB operations: init, get, put, delete, clear, load
 *
 * @module services/cache/CacheIndexedDBStore
 * Extracted from AdminBoundariesCacheManager.ts (ADR-065 Phase 3, #15)
 */

import type { CacheEntry } from './cache-types';

/**
 * IndexedDB persistence store for cache entries
 */
export class CacheIndexedDBStore {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly dbVersion: number;

  constructor(dbName = 'AdminBoundariesCache', dbVersion = 1) {
    this.dbName = dbName;
    this.dbVersion = dbVersion;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('boundaries')) {
          const boundariesStore = db.createObjectStore('boundaries', { keyPath: 'key' });
          boundariesStore.createIndex('adminLevel', 'adminLevel', { unique: false });
          boundariesStore.createIndex('region', 'region', { unique: false });
          boundariesStore.createIndex('timestamp', 'timestamp', { unique: false });
          boundariesStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  get isReady(): boolean {
    return this.db !== null;
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  async get<T = unknown>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['boundaries'], 'readonly');
      const store = transaction.objectStore('boundaries');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as CacheEntry<T> | undefined;
        if (result) {
          if (Date.now() - result.timestamp <= result.ttl) {
            resolve(result);
          } else {
            this.delete(key);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  async put<T = unknown>(entry: CacheEntry<T>): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['boundaries'], 'readwrite');
      const store = transaction.objectStore('boundaries');
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['boundaries'], 'readwrite');
      const store = transaction.objectStore('boundaries');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['boundaries'], 'readwrite');
      const store = transaction.objectStore('boundaries');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async loadAll(): Promise<CacheEntry[]> {
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['boundaries'], 'readonly');
      const store = transaction.objectStore('boundaries');
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const validEntries = entries.filter(entry => Date.now() - entry.timestamp <= entry.ttl);

        // Remove expired entries
        const expiredKeys = entries
          .filter(entry => Date.now() - entry.timestamp > entry.ttl)
          .map(entry => entry.key);
        for (const key of expiredKeys) {
          this.delete(key);
        }

        resolve(validEntries);
      };

      request.onerror = () => resolve([]);
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
