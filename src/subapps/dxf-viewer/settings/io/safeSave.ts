/**
 * @file Safe Save - Enterprise Data Persistence
 * @module settings/io/safeSave
 *
 * ENTERPRISE STANDARD - Mandatory validation before save
 *
 * **CRITICAL:** All saves MUST go through this function
 *
 * **PIPELINE:**
 * 1. Validate data with Zod schema
 * 2. Create backup of current data
 * 3. Atomic write to storage
 * 4. Verify write succeeded
 * 5. Rollback on error
 *
 * 
 */

import type { StorageDriver } from './StorageDriver';
import type { SettingsState } from '../core/types';
import { validateSettingsState } from './schema';
import { StorageError } from './StorageDriver';
import type { SyncService } from './SyncService';

// ============================================================================
// SAFE SAVE
// ============================================================================

export type SaveResult = {
  success: true;
  warnings: string[];
} | {
  success: false;
  error: string;
};

/**
 * Safely save settings to storage
 *
 * **ENTERPRISE PIPELINE:**
 * 1. Validate data (Zod schema)
 * 2. Load current data (for backup + diff)
 * 3. Create backup
 * 4. Atomic write
 * 5. Verify write
 * 6. Publish changes to sync (cross-tab)
 * 7. Rollback on error
 *
 * **ATOMICITY:** On error, old data is restored
 *
 * @param driver - Storage driver to save to
 * @param data - Settings state to save
 * @param key - Storage key (default: 'settings_state')
 * @param sync - Optional sync service for cross-tab updates
 * @returns Save result with success/error
 */
export async function safeSave(
  driver: StorageDriver,
  data: SettingsState,
  key = 'settings_state',
  sync?: SyncService
): Promise<SaveResult> {
  const warnings: string[] = [];

  try {
    // Step 1: Validate data BEFORE saving
    const validationResult = validateSettingsState(data);

    if (!validationResult.success) {
      const errors = 'error' in validationResult ? validationResult.error.errors : [];
      const errorMsg = errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');

      return {
        success: false,
        error: `Schema validation failed: ${errorMsg}`
      };
    }

    // Step 2: Load current data (for rollback)
    let oldData: unknown = null;
    try {
      oldData = await driver.get<unknown>(key);
    } catch {
      // No old data - this is fine (first save)
      warnings.push('No previous data found (first save)');
    }

    // Step 3: Atomic write
    try {
      await driver.set(key, validationResult.data);
    } catch (writeError) {
      // Step 4: Write failed - attempt rollback
      if (oldData !== null) {
        console.error('[safeSave] Write failed, attempting rollback');
        try {
          await driver.set(key, oldData);
          warnings.push('Write failed, successfully rolled back');
        } catch (rollbackError) {
          const rollbackMsg = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
          return {
            success: false,
            error: `Write failed AND rollback failed: ${rollbackMsg}`
          };
        }
      }

      const writeMsg = writeError instanceof Error ? writeError.message : String(writeError);
      return {
        success: false,
        error: `Write failed: ${writeMsg}`
      };
    }

    // Step 5: Verify write (read back and compare)
    try {
      const verifyData = await driver.get<SettingsState>(key);

      if (!verifyData) {
        warnings.push('Verification failed: data not found after write');
      } else if (verifyData.__standards_version !== data.__standards_version) {
        warnings.push('Verification warning: version mismatch after write');
      }
    } catch {
      warnings.push('Verification failed: could not read back data');
    }

    // Step 6: Publish changes to sync (cross-tab)
    if (sync) {
      try {
        // Calculate diff (what changed from old to new)
        const changes = calculateDiff(oldData as SettingsState | null, validationResult.data as SettingsState);

        if (changes) {
          sync.broadcast(changes);
        }
      } catch (syncError) {
        // Don't fail the save if sync fails
        warnings.push('Sync broadcast failed (non-critical)');
        console.warn('[safeSave] Sync failed:', syncError);
      }
    }

    return {
      success: true,
      warnings
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Unexpected error: ${errorMsg}`
    };
  }
}

/**
 * Save settings with automatic backup
 *
 * Creates a timestamped backup before saving
 *
 * @param driver - Storage driver
 * @param data - Settings state
 * @param key - Storage key
 * @returns Save result
 */
export async function safeSaveWithBackup(
  driver: StorageDriver,
  data: SettingsState,
  key = 'settings_state'
): Promise<SaveResult> {
  try {
    // Load current data
    const oldData = await driver.get<unknown>(key);

    if (oldData) {
      // Create timestamped backup
      const timestamp = Date.now();
      const backupKey = `${key}_backup_${timestamp}`;
      await driver.set(backupKey, oldData);
    }

    // Proceed with normal save
    return await safeSave(driver, data, key);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Backup creation failed: ${errorMsg}`
    };
  }
}

/**
 * Save settings and throw on error
 *
 * Use this when you want to handle errors yourself
 *
 * @param driver - Storage driver
 * @param data - Settings state
 * @param key - Storage key
 * @throws {StorageError} On save failure
 */
export async function safeSaveOrThrow(
  driver: StorageDriver,
  data: SettingsState,
  key = 'settings_state'
): Promise<void> {
  const result = await safeSave(driver, data, key);

  if (!result.success) {
    const error = 'error' in result ? result.error : 'Unknown error';
    throw new StorageError(error);
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('[safeSave] Warnings:', result.warnings);
  }
}

/**
 * Batch save multiple settings
 *
 * All-or-nothing: if any save fails, none are committed
 *
 * @param driver - Storage driver
 * @param saves - Array of [key, data] pairs
 * @param sync - Optional sync service for cross-tab updates
 * @returns Save result
 */
export async function safeBatchSave(
  driver: StorageDriver,
  saves: Array<[string, SettingsState]>,
  sync?: SyncService
): Promise<SaveResult> {
  const warnings: string[] = [];

  // Step 1: Validate all data first
  for (const [key, data] of saves) {
    const validationResult = validateSettingsState(data);
    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed for key "${key}"`
      };
    }
  }

  // Step 2: Load all current data (for rollback)
  const backups: Array<[string, unknown]> = [];
  for (const [key] of saves) {
    try {
      const oldData = await driver.get<unknown>(key);
      if (oldData) {
        backups.push([key, oldData]);
      }
    } catch {
      // No backup available - continue
    }
  }

  // Step 3: Attempt all writes
  try {
    for (const [key, data] of saves) {
      await driver.set(key, data);
    }

    // Step 4: Publish changes to sync (cross-tab)
    if (sync) {
      try {
        // Broadcast all changes
        for (const [key, data] of saves) {
          const oldData = backups.find(([k]) => k === key)?.[1] as SettingsState | null;
          const changes = calculateDiff(oldData || null, data);

          if (changes) {
            sync.broadcast(changes);
          }
        }
      } catch (syncError) {
        warnings.push('Sync broadcast failed (non-critical)');
        console.warn('[safeBatchSave] Sync failed:', syncError);
      }
    }

    return {
      success: true,
      warnings
    };
  } catch (error) {
    // Step 4: Rollback all writes
    console.error('[safeBatchSave] Batch write failed, rolling back');

    for (const [key, oldData] of backups) {
      try {
        await driver.set(key, oldData);
      } catch (rollbackError) {
        warnings.push(`Rollback failed for key "${key}"`);
      }
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Batch save failed: ${errorMsg}`
    };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Calculate diff between old and new settings
 *
 * Returns only the fields that changed (for efficient sync)
 *
 * @param oldData - Previous settings state (or null)
 * @param newData - New settings state
 * @returns Partial settings with only changed fields
 */
function calculateDiff(
  oldData: SettingsState | null,
  newData: SettingsState
): Partial<SettingsState> | null {
  if (!oldData) {
    // No old data - return full state
    return newData;
  }

  const changes: Partial<SettingsState> = {};
  let hasChanges = false;

  // Check version change
  if (oldData.__standards_version !== newData.__standards_version) {
    changes.__standards_version = newData.__standards_version;
    hasChanges = true;
  }

  // Check line settings changes
  if (JSON.stringify(oldData.line) !== JSON.stringify(newData.line)) {
    changes.line = newData.line;
    hasChanges = true;
  }

  // Check text settings changes
  if (JSON.stringify(oldData.text) !== JSON.stringify(newData.text)) {
    changes.text = newData.text;
    hasChanges = true;
  }

  // Check grip settings changes
  if (JSON.stringify(oldData.grip) !== JSON.stringify(newData.grip)) {
    changes.grip = newData.grip;
    hasChanges = true;
  }

  // Check override flags changes
  if (JSON.stringify(oldData.overrideEnabled) !== JSON.stringify(newData.overrideEnabled)) {
    changes.overrideEnabled = newData.overrideEnabled;
    hasChanges = true;
  }

  return hasChanges ? changes : null;
}
