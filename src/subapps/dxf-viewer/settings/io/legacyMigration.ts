/**
 * @file Legacy Migration - Old DxfSettingsProvider → Enterprise SettingsState
 * @module settings/io/legacyMigration
 *
 * ENTERPRISE STANDARD - Phase 2: Data Migration Layer
 *
 * **PURPOSE:**
 * Μετατροπή του παλιού DxfSettingsState format στο νέο Enterprise SettingsState format
 * χωρίς data loss. Διασφαλίζει ότι όλα τα υπάρχοντα settings του χρήστη διατηρούνται.
 *
 * **OLD FORMAT** (DxfSettingsProvider - 2606 γραμμές):
 * ```typescript
 * {
 *   line: LineSettings,              // FLAT
 *   text: TextSettings,              // FLAT
 *   grip: GripSettings,              // FLAT
 *   specific: {
 *     line?: { draft?, hover?, selection?, completion? },
 *     text?: { draft? },
 *     grip?: { draft? }
 *   },
 *   overrides: {
 *     line?: { draft?, hover?, selection?, completion? },
 *     text?: { draft? },
 *     grip?: { draft? }
 *   },
 *   overrideEnabled: {
 *     line: { draft, hover, selection, completion },
 *     text: { draft },
 *     grip: { draft }
 *   },
 *   grid, ruler, cursor, templateOverrides, activeTemplates, metadata...
 * }
 * ```
 *
 * **NEW FORMAT** (Enterprise SettingsState):
 * ```typescript
 * {
 *   __standards_version: 1,
 *   line: {
 *     general: LineSettings,
 *     specific: Record<StorageMode, Partial<LineSettings>>,
 *     overrides: Record<StorageMode, Partial<LineSettings>>
 *   },
 *   text: { general, specific, overrides },
 *   grip: { general, specific, overrides },
 *   overrideEnabled: {
 *     line: Record<StorageMode, boolean>,
 *     text: Record<StorageMode, boolean>,
 *     grip: Record<StorageMode, boolean>
 *   }
 * }
 * ```
 *
 * **CHANGES**:
 * 1. ✅ FLAT → 3-Layer (general/specific/overrides)
 * 2. ✅ Optional properties → Required properties με empty defaults
 * 3. ✅ Removed: grid, ruler, cursor (not DXF entity settings)
 * 4. ✅ Removed: templateOverrides, activeTemplates (legacy system)
 * 5. ✅ Removed: metadata (isLoaded, lastSaved, saveStatus)
 * 6. ✅ Added: __standards_version (for future migrations)
 *
 * **BACKWARD COMPATIBILITY**:
 * - 'preview' mode → mapped to 'draft' (alias support)
 * - Missing modes → filled with empty objects {}
 * - Invalid data → graceful fallback to FACTORY_DEFAULTS
 *
 * @see {@link ../FACTORY_DEFAULTS.ts} - Factory default values
 * @see {@link ../core/types.ts} - Enterprise type definitions
 * @see {@link ../../providers/DxfSettingsProvider.tsx} - Legacy provider
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 * @version 1.0.0 (Phase 2)
 */

import type { SettingsState, LineSettings, TextSettings, GripSettings, StorageMode } from '../core/types';
import { FACTORY_DEFAULTS } from '../FACTORY_DEFAULTS';

// ============================================================================
// LEGACY TYPE DEFINITIONS
// ============================================================================

/**
 * Legacy DxfSettingsState structure (from old DxfSettingsProvider)
 *
 * This is the exact structure we're migrating FROM
 */
interface LegacyDxfSettingsState {
  // Flat settings
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;

  // Mode-specific (optional, nested)
  specific?: {
    line?: {
      draft?: Partial<LineSettings>;
      hover?: Partial<LineSettings>;
      selection?: Partial<LineSettings>;
      completion?: Partial<LineSettings>;
      preview?: Partial<LineSettings>;  // Alias for draft
    };
    text?: {
      draft?: Partial<TextSettings>;
      preview?: Partial<TextSettings>;  // Alias for draft
    };
    grip?: {
      draft?: Partial<GripSettings>;
      preview?: Partial<GripSettings>;  // Alias for draft
    };
  };

  // Overrides (optional, nested)
  overrides?: {
    line?: {
      draft?: Partial<LineSettings>;
      hover?: Partial<LineSettings>;
      selection?: Partial<LineSettings>;
      completion?: Partial<LineSettings>;
      preview?: Partial<LineSettings>;  // Alias for draft
    };
    text?: {
      draft?: Partial<TextSettings>;
      preview?: Partial<TextSettings>;  // Alias for draft
    };
    grip?: {
      draft?: Partial<GripSettings>;
      preview?: Partial<GripSettings>;  // Alias for draft
    };
  };

  // Override flags (required)
  overrideEnabled?: {
    line: {
      draft: boolean;
      hover: boolean;
      selection: boolean;
      completion: boolean;
    };
    text: {
      draft: boolean;
    };
    grip: {
      draft: boolean;
    };
  };

  // Removed fields (not needed in enterprise)
  grid?: unknown;
  ruler?: unknown;
  cursor?: unknown;
  mode?: unknown;
  templateOverrides?: unknown;
  activeTemplates?: unknown;
  isLoaded?: unknown;
  lastSaved?: unknown;
  saveStatus?: unknown;
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

/**
 * Migrate legacy DxfSettingsState to enterprise SettingsState
 *
 * **PROCESS**:
 * 1. Extract flat settings → general layer
 * 2. Extract specific.* → specific layer (with preview→draft mapping)
 * 3. Extract overrides.* → overrides layer (with preview→draft mapping)
 * 4. Extract overrideEnabled → flags (fill missing modes with false)
 * 5. Add __standards_version: 1
 * 6. Discard grid/ruler/cursor/templates/metadata
 *
 * **SAFETY**:
 * - Never throws (returns FACTORY_DEFAULTS on error)
 * - Handles missing/undefined fields gracefully
 * - Preserves all user customizations
 *
 * @param oldState - Legacy DxfSettingsState
 * @returns Enterprise SettingsState
 */
export function migrateFromLegacyProvider(
  oldState: unknown
): SettingsState {
  try {
    // Type check
    if (!oldState || typeof oldState !== 'object') {
      console.warn('[Legacy Migration] Invalid state, using factory defaults');
      return FACTORY_DEFAULTS;
    }

    const legacy = oldState as Partial<LegacyDxfSettingsState>;

    // Validate required fields exist
    if (!legacy.line || !legacy.text || !legacy.grip) {
      console.warn('[Legacy Migration] Missing required fields, using factory defaults');
      return FACTORY_DEFAULTS;
    }

    // Build enterprise state
    const enterpriseState: SettingsState = {
      __standards_version: 1,

      // LINE SETTINGS
      line: {
        general: legacy.line,
        specific: {
          normal: {},
          draft: migrateLineSpecific(legacy.specific?.line, 'draft'),
          hover: migrateLineSpecific(legacy.specific?.line, 'hover'),
          selection: migrateLineSpecific(legacy.specific?.line, 'selection'),
          completion: migrateLineSpecific(legacy.specific?.line, 'completion')
        },
        overrides: {
          normal: {},
          draft: migrateLineOverrides(legacy.overrides?.line, 'draft'),
          hover: migrateLineOverrides(legacy.overrides?.line, 'hover'),
          selection: migrateLineOverrides(legacy.overrides?.line, 'selection'),
          completion: migrateLineOverrides(legacy.overrides?.line, 'completion')
        }
      },

      // TEXT SETTINGS
      text: {
        general: legacy.text,
        specific: {
          normal: {},
          draft: migrateTextSpecific(legacy.specific?.text, 'draft'),
          hover: {},
          selection: {},
          completion: {}
        },
        overrides: {
          normal: {},
          draft: migrateTextOverrides(legacy.overrides?.text, 'draft'),
          hover: {},
          selection: {},
          completion: {}
        }
      },

      // GRIP SETTINGS
      grip: {
        general: legacy.grip,
        specific: {
          normal: {},
          draft: migrateGripSpecific(legacy.specific?.grip, 'draft'),
          hover: {},
          selection: {},
          completion: {}
        },
        overrides: {
          normal: {},
          draft: migrateGripOverrides(legacy.overrides?.grip, 'draft'),
          hover: {},
          selection: {},
          completion: {}
        }
      },

      // OVERRIDE FLAGS
      overrideEnabled: {
        line: {
          normal: false,
          draft: legacy.overrideEnabled?.line?.draft ?? false,
          hover: legacy.overrideEnabled?.line?.hover ?? false,
          selection: legacy.overrideEnabled?.line?.selection ?? false,
          completion: legacy.overrideEnabled?.line?.completion ?? false
        },
        text: {
          normal: false,
          draft: legacy.overrideEnabled?.text?.draft ?? false,
          hover: false,
          selection: false,
          completion: false
        },
        grip: {
          normal: false,
          draft: legacy.overrideEnabled?.grip?.draft ?? false,
          hover: false,
          selection: false,
          completion: false
        }
      }
    };

    console.log('[Legacy Migration] Migration successful:', {
      from: 'DxfSettingsProvider (legacy)',
      to: 'Enterprise SettingsState v1',
      preserved: {
        lineGeneral: !!legacy.line,
        textGeneral: !!legacy.text,
        gripGeneral: !!legacy.grip,
        specificSettings: !!legacy.specific,
        overrideSettings: !!legacy.overrides,
        overrideFlags: !!legacy.overrideEnabled
      }
    });

    return enterpriseState;

  } catch (error) {
    console.error('[Legacy Migration] Migration failed:', error);
    return FACTORY_DEFAULTS;
  }
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Migrate line-specific settings for a mode
 *
 * Handles 'preview' → 'draft' alias mapping
 */
function migrateLineSpecific(
  lineSpecific: NonNullable<LegacyDxfSettingsState['specific']>['line'] | undefined,
  mode: 'draft' | 'hover' | 'selection' | 'completion'
): Partial<LineSettings> {
  if (!lineSpecific) return {};

  // Check for mode-specific settings
  if (mode in lineSpecific && lineSpecific[mode]) {
    return lineSpecific[mode]!;
  }

  // Check for 'preview' alias (only for draft mode)
  if (mode === 'draft' && lineSpecific.preview) {
    return lineSpecific.preview;
  }

  return {};
}

/**
 * Migrate line-override settings for a mode
 */
function migrateLineOverrides(
  lineOverrides: NonNullable<LegacyDxfSettingsState['overrides']>['line'] | undefined,
  mode: 'draft' | 'hover' | 'selection' | 'completion'
): Partial<LineSettings> {
  if (!lineOverrides) return {};

  if (mode in lineOverrides && lineOverrides[mode]) {
    return lineOverrides[mode]!;
  }

  if (mode === 'draft' && lineOverrides.preview) {
    return lineOverrides.preview;
  }

  return {};
}

/**
 * Migrate text-specific settings for a mode
 */
function migrateTextSpecific(
  textSpecific: NonNullable<LegacyDxfSettingsState['specific']>['text'] | undefined,
  mode: 'draft'
): Partial<TextSettings> {
  if (!textSpecific) return {};

  if (mode === 'draft') {
    return textSpecific.draft || textSpecific.preview || {};
  }

  return {};
}

/**
 * Migrate text-override settings for a mode
 */
function migrateTextOverrides(
  textOverrides: NonNullable<LegacyDxfSettingsState['overrides']>['text'] | undefined,
  mode: 'draft'
): Partial<TextSettings> {
  if (!textOverrides) return {};

  if (mode === 'draft') {
    return textOverrides.draft || textOverrides.preview || {};
  }

  return {};
}

/**
 * Migrate grip-specific settings for a mode
 */
function migrateGripSpecific(
  gripSpecific: NonNullable<LegacyDxfSettingsState['specific']>['grip'] | undefined,
  mode: 'draft'
): Partial<GripSettings> {
  if (!gripSpecific) return {};

  if (mode === 'draft') {
    return gripSpecific.draft || gripSpecific.preview || {};
  }

  return {};
}

/**
 * Migrate grip-override settings for a mode
 */
function migrateGripOverrides(
  gripOverrides: NonNullable<LegacyDxfSettingsState['overrides']>['grip'] | undefined,
  mode: 'draft'
): Partial<GripSettings> {
  if (!gripOverrides) return {};

  if (mode === 'draft') {
    return gripOverrides.draft || gripOverrides.preview || {};
  }

  return {};
}

// ============================================================================
// DETECTION HELPERS
// ============================================================================

/**
 * Detect if state is legacy format
 *
 * **HEURISTICS**:
 * - Has 'line' as flat LineSettings (not { general, specific, overrides })
 * - Missing __standards_version
 * - Has legacy fields (grid, ruler, cursor, templateOverrides)
 *
 * @param state - Unknown state
 * @returns True if legacy format
 */
export function isLegacyFormat(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false;

  const obj = state as Record<string, unknown>;

  // Check for __standards_version (enterprise has this)
  if ('__standards_version' in obj) {
    return false; // Enterprise format
  }

  // Check for flat line/text/grip (legacy has this)
  if ('line' in obj && typeof obj.line === 'object' && obj.line !== null) {
    const line = obj.line as Record<string, unknown>;

    // Legacy has line.lineWidth directly
    // Enterprise has line.general.lineWidth
    if ('lineWidth' in line) {
      return true; // Legacy format
    }
  }

  // Check for legacy-specific fields
  if ('grid' in obj || 'ruler' in obj || 'cursor' in obj || 'templateOverrides' in obj) {
    return true; // Legacy format
  }

  return false;
}

/**
 * Get migration info for debugging
 */
export function getMigrationInfo(state: unknown): {
  isLegacy: boolean;
  hasData: boolean;
  version: number | null;
  recommendedAction: string;
} {
  const isLegacy = isLegacyFormat(state);
  const hasData = state !== null && state !== undefined;

  let version: number | null = null;
  if (state && typeof state === 'object' && '__standards_version' in state) {
    version = (state as { __standards_version: number }).__standards_version;
  }

  let recommendedAction: string;
  if (!hasData) {
    recommendedAction = 'Load factory defaults';
  } else if (isLegacy) {
    recommendedAction = 'Migrate from legacy format';
  } else {
    recommendedAction = version === 1 ? 'Load as-is' : `Migrate from v${version} to v1`;
  }

  return {
    isLegacy,
    hasData,
    version,
    recommendedAction
  };
}
