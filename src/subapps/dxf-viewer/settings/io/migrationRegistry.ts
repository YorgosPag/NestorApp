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
  // Version 1 → 2: Fix property names to match TypeScript interfaces
  // CRITICAL: This migration fixes the mismatch between old property names and TypeScript interfaces
  {
    version: 2,
    description: 'Fix property names: lineColor→color, lineStyle→lineType, textColor→color, size→gripSize, color/hoverColor→colors{cold,warm,hot,contour}',
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
        line: fixLinePropertyNames(state.line),
        text: fixTextPropertyNames(state.text),
        grip: fixGripPropertyNames(state.grip)
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
        line: revertLinePropertyNames(state.line),
        text: revertTextPropertyNames(state.text),
        grip: revertGripPropertyNames(state.grip)
      };
    }
  },

  // Version 2 → 3: Fix fontWeight type (string → number)
  // CRITICAL: ChatGPT5 fix for schema validation errors
  {
    version: 3,
    description: 'Fix fontWeight: convert string values (bold/normal) to numbers (700/400)',
    migrate: (data: unknown) => {
      const state = data as any;

      // ✅ ENTERPRISE: ChatGPT5 solution - normalize fontWeight
      const toWeight = (w: any): number => {
        if (typeof w === 'string') {
          return w === 'bold' ? 700 : w === 'normal' ? 400 : Number(w) || 400;
        }
        return typeof w === 'number' ? w : 400;
      };

      // Fix all fontWeight properties
      if (state.text?.general?.fontWeight) {
        state.text.general.fontWeight = toWeight(state.text.general.fontWeight);
      }

      if (state.text?.specific) {
        Object.keys(state.text.specific).forEach(mode => {
          if (state.text.specific[mode]?.fontWeight) {
            state.text.specific[mode].fontWeight = toWeight(state.text.specific[mode].fontWeight);
          }
        });
      }

      return {
        ...state,
        __standards_version: 3
      };
    },
    rollback: (data: unknown) => {
      const state = data as any;

      // Convert numbers back to strings
      const toWeightString = (w: any): string => {
        if (typeof w === 'number') {
          return w >= 700 ? 'bold' : 'normal';
        }
        return w || 'normal';
      };

      if (state.text?.general?.fontWeight) {
        state.text.general.fontWeight = toWeightString(state.text.general.fontWeight);
      }

      if (state.text?.specific) {
        Object.keys(state.text.specific).forEach(mode => {
          if (state.text.specific[mode]?.fontWeight) {
            state.text.specific[mode].fontWeight = toWeightString(state.text.specific[mode].fontWeight);
          }
        });
      }

      return {
        ...state,
        __standards_version: 2
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
// PROPERTY NAME MIGRATIONS (v1 → v2)
// ============================================================================

/**
 * Fix Line property names: lineColor → color, lineStyle → lineType
 */
function fixLinePropertyNames(entitySettings: unknown): unknown {
  const entity = entitySettings as {
    general: Record<string, unknown>;
    specific: Record<string, Record<string, unknown>>;
    overrides: Record<string, Record<string, unknown>>;
  };

  const fixLineSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const fixed = { ...settings };

    // lineColor → color
    if ('lineColor' in fixed) {
      fixed.color = fixed.lineColor;
      delete fixed.lineColor;
    }

    // lineStyle → lineType
    if ('lineStyle' in fixed) {
      fixed.lineType = fixed.lineStyle;
      delete fixed.lineStyle;
    }

    // ✅ FIX: Add enabled property if missing (for LinePreview)
    if (!('enabled' in fixed)) {
      fixed.enabled = true;
    }

    return fixed;
  };

  return {
    general: fixLineSettings(entity.general),
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? fixLineSettings(settings as Record<string, unknown>) : settings
      ])
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? fixLineSettings(settings as Record<string, unknown>) : settings
      ])
    )
  };
}

/**
 * Fix Text property names: textColor → color
 */
function fixTextPropertyNames(entitySettings: unknown): unknown {
  const entity = entitySettings as {
    general: Record<string, unknown>;
    specific: Record<string, Record<string, unknown>>;
    overrides: Record<string, Record<string, unknown>>;
  };

  const fixTextSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const fixed = { ...settings };

    // textColor → color
    if ('textColor' in fixed) {
      fixed.color = fixed.textColor;
      delete fixed.textColor;
    }

    // ✅ FIX: Add enabled property if missing (for LinePreview)
    if (!('enabled' in fixed)) {
      fixed.enabled = true;
    }

    return fixed;
  };

  return {
    general: fixTextSettings(entity.general),
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? fixTextSettings(settings as Record<string, unknown>) : settings
      ])
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? fixTextSettings(settings as Record<string, unknown>) : settings
      ])
    )
  };
}

/**
 * Fix Grip property names: size → gripSize, color/hoverColor → colors{cold,warm,hot,contour}
 */
function fixGripPropertyNames(entitySettings: unknown): unknown {
  const entity = entitySettings as {
    general: Record<string, unknown>;
    specific: Record<string, Record<string, unknown>>;
    overrides: Record<string, Record<string, unknown>>;
  };

  const fixGripSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const fixed = { ...settings };

    // size → gripSize
    if ('size' in fixed) {
      fixed.gripSize = fixed.size;
      delete fixed.size;
    }

    // color/hoverColor → colors{cold,warm,hot,contour}
    if ('color' in fixed || 'hoverColor' in fixed) {
      fixed.colors = {
        cold: fixed.color || '#0000FF',           // Blue (unselected)
        warm: fixed.hoverColor || '#00FFFF',      // Cyan (hover)
        hot: '#FF0000',                           // Red (selected)
        contour: '#000000'                        // Black (contour)
      };
      delete fixed.color;
      delete fixed.hoverColor;
    }

    // ✅ FIX: Add enabled property if missing (for LinePreview)
    if (!('enabled' in fixed)) {
      fixed.enabled = true;
    }

    return fixed;
  };

  return {
    general: fixGripSettings(entity.general),
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? fixGripSettings(settings as Record<string, unknown>) : settings
      ])
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? fixGripSettings(settings as Record<string, unknown>) : settings
      ])
    )
  };
}

/**
 * Revert Line property names: color → lineColor, lineType → lineStyle (rollback)
 */
function revertLinePropertyNames(entitySettings: unknown): unknown {
  const entity = entitySettings as {
    general: Record<string, unknown>;
    specific: Record<string, Record<string, unknown>>;
    overrides: Record<string, Record<string, unknown>>;
  };

  const revertLineSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const reverted = { ...settings };

    if ('color' in reverted) {
      reverted.lineColor = reverted.color;
      delete reverted.color;
    }

    if ('lineType' in reverted) {
      reverted.lineStyle = reverted.lineType;
      delete reverted.lineType;
    }

    return reverted;
  };

  return {
    general: revertLineSettings(entity.general),
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? revertLineSettings(settings as Record<string, unknown>) : settings
      ])
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? revertLineSettings(settings as Record<string, unknown>) : settings
      ])
    )
  };
}

/**
 * Revert Text property names: color → textColor (rollback)
 */
function revertTextPropertyNames(entitySettings: unknown): unknown {
  const entity = entitySettings as {
    general: Record<string, unknown>;
    specific: Record<string, Record<string, unknown>>;
    overrides: Record<string, Record<string, unknown>>;
  };

  const revertTextSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const reverted = { ...settings };

    if ('color' in reverted) {
      reverted.textColor = reverted.color;
      delete reverted.color;
    }

    return reverted;
  };

  return {
    general: revertTextSettings(entity.general),
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? revertTextSettings(settings as Record<string, unknown>) : settings
      ])
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? revertTextSettings(settings as Record<string, unknown>) : settings
      ])
    )
  };
}

/**
 * Revert Grip property names: gripSize → size, colors{} → color/hoverColor (rollback)
 */
function revertGripPropertyNames(entitySettings: unknown): unknown {
  const entity = entitySettings as {
    general: Record<string, unknown>;
    specific: Record<string, Record<string, unknown>>;
    overrides: Record<string, Record<string, unknown>>;
  };

  const revertGripSettings = (settings: Record<string, unknown>): Record<string, unknown> => {
    const reverted = { ...settings };

    if ('gripSize' in reverted) {
      reverted.size = reverted.gripSize;
      delete reverted.gripSize;
    }

    if ('colors' in reverted && typeof reverted.colors === 'object') {
      const colors = reverted.colors as { cold?: string; warm?: string };
      reverted.color = colors.cold || '#0000FF';
      reverted.hoverColor = colors.warm || '#00FFFF';
      delete reverted.colors;
    }

    return reverted;
  };

  return {
    general: revertGripSettings(entity.general),
    specific: Object.fromEntries(
      Object.entries(entity.specific).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? revertGripSettings(settings as Record<string, unknown>) : settings
      ])
    ),
    overrides: Object.fromEntries(
      Object.entries(entity.overrides).map(([mode, settings]) => [
        mode,
        settings && typeof settings === 'object' ? revertGripSettings(settings as Record<string, unknown>) : settings
      ])
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
