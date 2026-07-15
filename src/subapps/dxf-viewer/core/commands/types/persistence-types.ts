/**
 * Command persistence types (extracted from `../interfaces.ts` for SRP / file-size — N.7.1).
 *
 * The session-restore persistence contract + its configuration. Re-exported from
 * `../interfaces.ts` so every existing consumer import stays unchanged.
 */

import type { SerializedCommand } from '../interfaces';

/**
 * 🏢 ENTERPRISE: Persistence interface for session restore
 */
export interface ICommandPersistence {
  /** Save command history to storage */
  save(undoStack: SerializedCommand[], redoStack: SerializedCommand[]): Promise<void>;

  /** Load command history from storage */
  load(): Promise<{ undoStack: SerializedCommand[]; redoStack: SerializedCommand[] } | null>;

  /** Clear stored history */
  clear(): Promise<void>;

  /** Check if storage is available */
  isAvailable(): boolean;
}

/**
 * Storage type for persistence
 */
export type PersistenceStorage = 'localStorage' | 'indexedDB' | 'memory';

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  /** Storage type */
  storage: PersistenceStorage;

  /** Storage key prefix */
  keyPrefix: string;

  /** Auto-save on each command */
  autoSave: boolean;

  /** Auto-save debounce (ms) */
  autoSaveDebounce: number;

  /** Max commands to persist */
  maxPersisted: number;
}
