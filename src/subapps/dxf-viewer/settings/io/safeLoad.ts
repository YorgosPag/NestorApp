/**
 * @file Safe Load - Enterprise Data Loading
 * @module settings/io/safeLoad
 *
 * ENTERPRISE STANDARD - Mandatory validation & migration pipeline
 *
 * **CRITICAL:** All loads MUST go through this function
 *
 * **PIPELINE:**
 * 1. Load raw data from storage
 * 2. Check version (migration needed?)
 * 3. Apply migrations if needed
 * 4. Validate with Zod schema
 * 5. Return validated data OR factory defaults
 *
 * 
 */

import type { StorageDriver } from './StorageDriver';
import type { SettingsState } from '../core/types';
import { validateSettingsState, validateAndCoerce } from './schema';
import { needsMigration, migrateToVersion, createBackup } from './migrationRegistry';
import { CURRENT_VERSION, FACTORY_DEFAULTS } from '../FACTORY_DEFAULTS';

// ============================================================================
// SAFE LOAD
// ============================================================================

export type LoadResult = {
  success: true;
  data: SettingsState;
  source: 'storage' | 'factory' | 'migrated' | 'coerced';
  warnings: string[];
} | {
  success: false;
  error: string;
  data: SettingsState; // Returns factory defaults on error
};

/**
 * Safely load settings from storage
 *
 * **ENTERPRISE PIPELINE:**
 * 1. Load from storage
 * 2. Validate version
 * 3. Migrate if needed
 * 4. Validate schema (Zod)
 * 5. Return valid data or factory defaults
 *
 * **NEVER THROWS** - Always returns valid data
 *
 * @param driver - Storage driver to load from
 * @param key - Storage key (default: 'settings_state')
 * @returns Load result with validated data
 */
export async function safeLoad(
  driver: StorageDriver,
  key = 'settings_state'
): Promise<LoadResult> {
  const warnings: string[] = [];

  try {
    // Step 1: Load raw data
    const rawData = await driver.get<unknown>(key);

    if (!rawData) {
      console.info('[safeLoad] No saved settings found, using factory defaults');
      return {
        success: true,
        data: FACTORY_DEFAULTS,
        source: 'factory',
        warnings: []
      };
    }

    // Step 2: Check if data has version field
    if (!rawData || typeof rawData !== 'object' || !('__standards_version' in rawData)) {
      warnings.push('Missing __standards_version, using factory defaults');
      return {
        success: true,
        data: FACTORY_DEFAULTS,
        source: 'factory',
        warnings
      };
    }

    let processedData = rawData;
    let source: 'storage' | 'migrated' | 'coerced' = 'storage';

    // Step 3: Migration needed?
    if (needsMigration(rawData, CURRENT_VERSION)) {
      console.info('[safeLoad] Migration needed, creating backup...');

      // Create backup before migration
      const backup = createBackup(rawData);

      try {
        // Store backup
        if (rawData && typeof rawData === 'object' && '__standards_version' in rawData) {
          await driver.set(`${key}_backup_v${(rawData as { __standards_version: number }).__standards_version}`, backup);
        }

        // Apply migrations
        const migrated = migrateToVersion(rawData, CURRENT_VERSION) as SettingsState;
        processedData = migrated;
        source = 'migrated';

        if (rawData && typeof rawData === 'object' && '__standards_version' in rawData) {
          warnings.push(`Migrated from v${(rawData as { __standards_version: number }).__standards_version} to v${CURRENT_VERSION}`);
        }

        console.info('[safeLoad] Migration successful');
      } catch (migrationError) {
        const errorMsg = migrationError instanceof Error ? migrationError.message : String(migrationError);
        warnings.push(`Migration failed: ${errorMsg}`);

        // Migration failed - use coercion instead
        processedData = rawData;
      }
    }

    // Step 4: Validate with Zod
    const validationResult = validateSettingsState(processedData);

    if (validationResult.success) {
      // Validation passed - data is fully typed as SettingsState
      return {
        success: true,
        data: validationResult.data as SettingsState,
        source,
        warnings
      };
    }

    // Step 5: Validation failed - try to coerce
    console.warn('[safeLoad] Validation failed, attempting to coerce');
    warnings.push('Schema validation failed, data was coerced');

    const coercedData = validateAndCoerce(processedData, FACTORY_DEFAULTS) as SettingsState;

    return {
      success: true,
      data: coercedData as SettingsState,
      source: 'coerced',
      warnings
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[safeLoad] Load failed, using factory defaults:', errorMsg);

    return {
      success: false,
      error: errorMsg,
      data: FACTORY_DEFAULTS
    };
  }
}

/**
 * Load settings or return factory defaults on any error
 *
 * Simpler version of safeLoad - just returns data
 *
 * @param driver - Storage driver
 * @param key - Storage key
 * @returns Valid settings state (never null)
 */
export async function loadOrDefault(
  driver: StorageDriver,
  key = 'settings_state'
): Promise<SettingsState> {
  const result = await safeLoad(driver, key);
  return result.data;
}

/**
 * Check if settings exist in storage
 *
 * @param driver - Storage driver
 * @param key - Storage key
 * @returns True if settings exist
 */
export async function hasSettings(
  driver: StorageDriver,
  key = 'settings_state'
): Promise<boolean> {
  try {
    const rawData = await driver.get<unknown>(key);
    return rawData !== null;
  } catch {
    return false;
  }
}
