/**
 * COMMAND PERSISTENCE
 *
 * 🏢 ENTERPRISE (2026-01-25): Session restore via IndexedDB/localStorage
 * Enables users to restore undo history after page refresh.
 *
 * Features:
 * - IndexedDB for large command histories
 * - localStorage fallback for simple cases
 * - Debounced auto-save
 * - Version migration support
 */

import type { ICommandPersistence, SerializedCommand, PersistenceConfig } from './interfaces';
import { DEFAULT_PERSISTENCE_CONFIG } from './interfaces';

const DB_NAME = 'dxf-viewer-commands';
const STORE_NAME = 'command-history';
const DB_VERSION = 1;

/**
 * Command Persistence implementation
 * Supports IndexedDB (primary) and localStorage (fallback)
 */
export class CommandPersistence implements ICommandPersistence {
  private config: PersistenceConfig;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
  }

  /**
   * Initialize IndexedDB connection
   */
  private async initDB(): Promise<void> {
    if (this.db) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (!this.isIndexedDBAvailable()) {
        resolve(); // Fall back to localStorage
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('[CommandPersistence] IndexedDB error, falling back to localStorage');
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Check if IndexedDB is available
   */
  private isIndexedDBAvailable(): boolean {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
      return false;
    }
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if any storage is available
   */
  isAvailable(): boolean {
    return this.isIndexedDBAvailable() || this.isLocalStorageAvailable();
  }

  /**
   * Save command history to storage
   */
  async save(undoStack: SerializedCommand[], redoStack: SerializedCommand[]): Promise<void> {
    const data = {
      undoStack: undoStack.slice(-this.config.maxPersisted),
      redoStack: redoStack.slice(-this.config.maxPersisted),
      timestamp: Date.now(),
      version: 1,
    };

    // Try IndexedDB first
    if (this.config.storage === 'indexedDB' && this.isIndexedDBAvailable()) {
      try {
        await this.saveToIndexedDB(data);
        return;
      } catch (error) {
        console.warn('[CommandPersistence] IndexedDB save failed, trying localStorage:', error);
      }
    }

    // Fall back to localStorage
    if (this.isLocalStorageAvailable()) {
      this.saveToLocalStorage(data);
    }
  }

  /**
   * Save to IndexedDB
   */
  private async saveToIndexedDB(data: PersistenceData): Promise<void> {
    await this.initDB();

    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put({
        key: this.config.keyPrefix,
        ...data,
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(data: PersistenceData): void {
    try {
      localStorage.setItem(this.config.keyPrefix, JSON.stringify(data));
    } catch (error) {
      console.error('[CommandPersistence] localStorage save failed:', error);
    }
  }

  /**
   * Load command history from storage
   */
  async load(): Promise<{ undoStack: SerializedCommand[]; redoStack: SerializedCommand[] } | null> {
    // Try IndexedDB first
    if (this.config.storage === 'indexedDB' && this.isIndexedDBAvailable()) {
      try {
        const data = await this.loadFromIndexedDB();
        if (data) {
          return { undoStack: data.undoStack, redoStack: data.redoStack };
        }
      } catch (error) {
        console.warn('[CommandPersistence] IndexedDB load failed, trying localStorage:', error);
      }
    }

    // Fall back to localStorage
    if (this.isLocalStorageAvailable()) {
      const data = this.loadFromLocalStorage();
      if (data) {
        return { undoStack: data.undoStack, redoStack: data.redoStack };
      }
    }

    return null;
  }

  /**
   * Load from IndexedDB
   */
  private async loadFromIndexedDB(): Promise<PersistenceData | null> {
    await this.initDB();

    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.get(this.config.keyPrefix);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve({
            undoStack: result.undoStack,
            redoStack: result.redoStack,
            timestamp: result.timestamp,
            version: result.version,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(): PersistenceData | null {
    try {
      const stored = localStorage.getItem(this.config.keyPrefix);
      if (stored) {
        return JSON.parse(stored) as PersistenceData;
      }
    } catch (error) {
      console.error('[CommandPersistence] localStorage load failed:', error);
    }
    return null;
  }

  /**
   * Clear stored history
   */
  async clear(): Promise<void> {
    // Clear IndexedDB
    if (this.isIndexedDBAvailable()) {
      try {
        await this.clearIndexedDB();
      } catch (error) {
        console.warn('[CommandPersistence] IndexedDB clear failed:', error);
      }
    }

    // Clear localStorage
    if (this.isLocalStorageAvailable()) {
      try {
        localStorage.removeItem(this.config.keyPrefix);
      } catch (error) {
        console.warn('[CommandPersistence] localStorage clear failed:', error);
      }
    }
  }

  /**
   * Clear IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    await this.initDB();

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.delete(this.config.keyPrefix);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

/**
 * Persistence data structure
 */
interface PersistenceData {
  undoStack: SerializedCommand[];
  redoStack: SerializedCommand[];
  timestamp: number;
  version: number;
}

/**
 * Create debounced save function
 */
export function createDebouncedSave(
  persistence: CommandPersistence,
  debounceMs: number = 1000
): (undoStack: SerializedCommand[], redoStack: SerializedCommand[]) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (undoStack: SerializedCommand[], redoStack: SerializedCommand[]) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      persistence.save(undoStack, redoStack).catch((error) => {
        console.error('[CommandPersistence] Auto-save failed:', error);
      });
    }, debounceMs);
  };
}
