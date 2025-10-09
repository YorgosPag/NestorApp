/**
 * @file Migration Registry
 * @module settings/io/migrationRegistry
 *
 * ENTERPRISE STANDARD - Schema version migrations
 *
 * **PURPOSE:**
 * - Handle schema evolution across versions
 * - Gracefully upgrade old data to new schema
 * - Prevent data loss during upgrades
 *
 * **PATTERN:**
 * - Incremental migrations (v1→v2, v2→v3, etc.)
 * - Pure functions (no side effects)
 * - Rollback capability (store backup before migration)
 *
 *  - Module #5
 */

import type { SettingsStateType } from './schema';

// ============================================================================
// MIGRATION TYPES
// ============================================================================

/**
 * Migration function signature
 *
 * @param data - Settings state at version N
 * @returns Settings state at version N+1
 */
export type MigrationFn = (data: unknown) => unknown;

/**
 * Migration metadata
 */
export interface Migration {
  version: number;           // Target version
  description: string;       // What changed
  migrate: MigrationFn;      // Migration function
  rollback?: MigrationFn;    // Optional rollback function
}

// ============================================================================
// MIGRATION REGISTRY
// ============================================================================

/**
 * Registry of all schema migrations
 *
 * **CRITICAL:** Add migrations in sequential order (v1, v2, v3, ...)
 */
export const migrations: Migration[] = [
  // Version 1 → 2: Add 'opacity' field to all entity settings
  // This is a REAL migration example for testing
  {
    version: 2,
    description: 'Add opacity field (0.0-1.0) to line/text/grip settings',
    migrate: (data: unknown) => {
      const state = data as {
        __standards_version: number;
        line: unknown;
        text: unknown;
        grip: unknown;
        overrideEnabled: unknown;
      };

      return {
        ...state,
        __standards_version: 2,
        line: addOpacityToEntity(state.line),
        text: addOpacityToEntity(state.text),
        grip: addOpacityToEntity(state.grip)
      };
    },
    rollback: (data: unknown) => {
      const state = data as {
        __standards_version: number;
        line: unknown;
        text: unknown;
        grip: unknown;
        overrideEnabled: unknown;
      };

      return {
        ...state,
        __standards_version: 1,
        line: removeOpacityFromEntity(state.line),
        text: removeOpacityFromEntity(state.text),
        grip: removeOpacityFromEntity(state.grip)
      };
    }
  }
];

// ============================================================================
// MIGRATION ENGINE
// ============================================================================

/**
 * Migrate data from old version to current version
 *
 * @param data - Raw data from storage
 * @param currentVersion - Target version (usually CURRENT_VERSION)
 * @returns Migrated data at target version
 */
export function migrateToVersion(
  data: unknown,
  currentVersion: number
): unknown {
  if (!data || typeof data !== 'object' || !('__standards_version' in data)) {
    throw new Error('Invalid data: missing __standards_version');
  }

  const dataWithVersion = data as { __standards_version: number };
  let migratedData = data;
  let fromVersion = dataWithVersion.__standards_version;

  console.log(
    `[Migration] Starting migration from v${fromVersion} to v${currentVersion}`
  );

  // Apply migrations sequentially
  while (fromVersion < currentVersion) {
    const nextVersion = fromVersion + 1;
    const migration = migrations.find(m => m.version === nextVersion);

    if (!migration) {
      throw new Error(
        `Missing migration for v${fromVersion} → v${nextVersion}. ` +
        'Cannot upgrade safely.'
      );
    }

    console.log(`[Migration] Applying v${nextVersion}: ${migration.description}`);

    try {
      const migrated = migration.migrate(migratedData);

      // Update version (type assertion for TypeScript - treat as versioned object)
      const versionedData = migrated as { __standards_version: number; [key: string]: unknown };
      versionedData.__standards_version = nextVersion;

      migratedData = versionedData;
      fromVersion = nextVersion;
    } catch (error) {
      throw new Error(
        `Migration v${fromVersion} → v${nextVersion} failed: ${error}`
      );
    }
  }

  console.log(`[Migration] Successfully migrated to v${currentVersion}`);
  return migratedData;
}

/**
 * Check if migration is needed
 *
 * @param data - Raw data from storage
 * @param currentVersion - Target version
 * @returns True if migration required
 */
export function needsMigration(
  data: unknown,
  currentVersion: number
): boolean {
  if (!data || typeof data !== 'object' || !('__standards_version' in data)) {
    return false; // Invalid data, can't migrate
  }

  const dataWithVersion = data as { __standards_version: number };
  return dataWithVersion.__standards_version < currentVersion;
}

/**
 * Rollback data to previous version
 *
 * **WARNING:** Only use this if migration corrupted data!
 *
 * @param data - Migrated data
 * @param targetVersion - Version to rollback to
 * @returns Rolled back data
 */
export function rollbackToVersion(
  data: unknown,
  targetVersion: number
): unknown {
  if (!data || typeof data !== 'object' || !('__standards_version' in data)) {
    throw new Error('Invalid data: missing __standards_version');
  }

  const dataWithVersion = data as { __standards_version: number };
  let rolledBackData = data;
  let fromVersion = dataWithVersion.__standards_version;

  console.warn(
    `[Migration] Rolling back from v${fromVersion} to v${targetVersion}`
  );

  // Apply rollbacks in reverse order
  while (fromVersion > targetVersion) {
    const migration = migrations.find(m => m.version === fromVersion);

    if (!migration?.rollback) {
      throw new Error(
        `Cannot rollback v${fromVersion}: no rollback function defined`
      );
    }

    console.warn(`[Migration] Rolling back v${fromVersion}`);

    try {
      const rolledBack = migration.rollback(rolledBackData);

      // Update version (type assertion for TypeScript - treat as versioned object)
      const prevVersion = fromVersion - 1;
      const versionedData = rolledBack as { __standards_version: number; [key: string]: unknown };
      versionedData.__standards_version = prevVersion;

      rolledBackData = versionedData;
      fromVersion = prevVersion;
    } catch (error) {
      throw new Error(
        `Rollback v${fromVersion} failed: ${error}`
      );
    }
  }

  console.warn(`[Migration] Rolled back to v${targetVersion}`);
  return rolledBackData;
}

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Create backup of data before migration
 *
 * @param data - Data to backup
 * @returns Deep copy of data
 */
export function createBackup(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Validate migration result
 *
 * @param data - Migrated data
 * @param schema - Zod schema to validate against
 * @returns True if valid
 */
export function validateMigration(
  data: unknown,
  schema: { safeParse: (data: unknown) => { success: boolean } }
): boolean {
  const result = schema.safeParse(data);
  return result.success;
}

// ============================================================================
// EXAMPLE MIGRATIONS (FOR REFERENCE)
// ============================================================================

/**
 * Add opacity field to entity settings (v1 → v2)
 *
 * This is used by the REAL migration in the registry
 */
function addOpacityToEntity(entitySettings: unknown): unknown {
  const DEFAULT_OPACITY = 1.0;

  const entity = entitySettings as {
    general: Record<string, unknown>;
    specific: Record<string, Record<string, unknown>>;
    overrides: Record<string, Record<string, unknown>>;
  };

  return {
    general: { ...entity.general, opacity: DEFAULT_OPACITY },
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? { ...settings, opacity: DEFAULT_OPACITY } : settings
      ])
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? { ...settings, opacity: DEFAULT_OPACITY } : settings
      ])
    )
  };
}

/**
 * Remove opacity field from entity settings (v2 → v1 rollback)
 */
function removeOpacityFromEntity(entitySettings: unknown): unknown {
  const entity = entitySettings as {
    general: Record<string, unknown>;
    specific: Record<string, Record<string, unknown>>;
    overrides: Record<string, Record<string, unknown>>;
  };

  const { opacity: _o1, ...generalWithoutOpacity } = entity.general;

  return {
    general: generalWithoutOpacity,
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => {
        if (settings && typeof settings === 'object') {
          const { opacity: _o, ...rest } = settings as Record<string, unknown>;
          return [mode, rest];
        }
        return [mode, settings];
      })
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => {
        if (settings && typeof settings === 'object') {
          const { opacity: _o, ...rest } = settings as Record<string, unknown>;
          return [mode, rest];
        }
        return [mode, settings];
      })
    )
  };
}

/**
 * Example: Rename field
 */
function renameField<T extends Record<string, unknown>>(
  obj: T,
  oldKey: string,
  newKey: string
): T {
  if (oldKey in obj) {
    const { [oldKey]: value, ...rest } = obj;
    return { ...rest, [newKey]: value } as T;
  }
  return obj;
}
