/**
 * @file Factory Defaults - Single Source of Truth
 * @module settings/FACTORY_DEFAULTS
 *
 * ENTERPRISE STANDARD - CAD Industry Standard Defaults
 *
 * **SOURCES:**
 * - ISO 128: Technical Drawings
 * - AutoCAD 2024 Defaults
 * - BricsCAD v24 Defaults
 *
 * **CRITICAL:** This is the ONLY place where default values are defined
 *
 *  - Module #8
 */

import type { SettingsState, StorageMode } from './core/types';
import { ACI_PALETTE } from './standards/aci';

// ============================================================================
// CURRENT SCHEMA VERSION
// ============================================================================

/**
 * Current settings schema version
 *
 * **INCREMENT THIS** when making breaking changes to settings structure
 */
export const CURRENT_VERSION = 1;

// ============================================================================
// LINE SETTINGS DEFAULTS
// ============================================================================

const LINE_DEFAULTS = {
  lineWidth: 0.25,              // 0.25mm (ISO 128 standard)
  lineColor: ACI_PALETTE[7] as string,    // White (ACI 7)
  lineStyle: 'solid' as const,
  opacity: 1.0
};

const LINE_DRAFT_DEFAULTS = {
  lineWidth: 0.18,              // Thinner for draft
  lineColor: ACI_PALETTE[8] as string,    // Gray (ACI 8)
  lineStyle: 'dashed' as const,
  opacity: 0.7                   // Slightly transparent
};

const LINE_HOVER_DEFAULTS = {
  lineColor: ACI_PALETTE[4] as string,    // Cyan (ACI 4) for hover
  opacity: 1.0
};

const LINE_SELECTION_DEFAULTS = {
  lineColor: ACI_PALETTE[1] as string,    // Red (ACI 1) for selection
  lineWidth: 0.35,              // Thicker for visibility
  opacity: 1.0
};

const LINE_COMPLETION_DEFAULTS = {
  lineColor: ACI_PALETTE[3] as string,    // Green (ACI 3) for completion
  opacity: 1.0
};

// ============================================================================
// TEXT SETTINGS DEFAULTS
// ============================================================================

const TEXT_DEFAULTS = {
  fontSize: 12,                 // 12pt (standard CAD text)
  fontFamily: 'Arial',          // Sans-serif (CAD standard)
  fontWeight: 'normal' as const,
  fontStyle: 'normal' as const,
  textColor: ACI_PALETTE[7] as string,    // White (ACI 7)
  opacity: 1.0
};

const TEXT_DRAFT_DEFAULTS = {
  fontSize: 10,                 // Smaller for draft
  textColor: ACI_PALETTE[8] as string,    // Gray (ACI 8)
  opacity: 0.7
};

const TEXT_HOVER_DEFAULTS = {
  textColor: ACI_PALETTE[4] as string,    // Cyan (ACI 4)
  opacity: 1.0
};

const TEXT_SELECTION_DEFAULTS = {
  textColor: ACI_PALETTE[1] as string,    // Red (ACI 1)
  fontWeight: 'bold' as const,
  opacity: 1.0
};

const TEXT_COMPLETION_DEFAULTS = {
  textColor: ACI_PALETTE[3] as string,    // Green (ACI 3)
  opacity: 1.0
};

// ============================================================================
// GRIP SETTINGS DEFAULTS
// ============================================================================

const GRIP_DEFAULTS = {
  size: 8,                      // 8px (standard CAD grip)
  color: ACI_PALETTE[5] as string,        // Blue (ACI 5)
  hoverColor: ACI_PALETTE[4] as string,   // Cyan (ACI 4) on hover
  shape: 'square' as const,     // Square (CAD standard)
  opacity: 1.0
};

const GRIP_DRAFT_DEFAULTS = {
  size: 6,                      // Smaller for draft
  opacity: 0.7
};

const GRIP_HOVER_DEFAULTS = {
  size: 10,                     // Larger on hover
  opacity: 1.0
};

const GRIP_SELECTION_DEFAULTS = {
  color: ACI_PALETTE[1] as string,        // Red (ACI 1)
  size: 10,
  opacity: 1.0
};

const GRIP_COMPLETION_DEFAULTS = {
  color: ACI_PALETTE[3] as string,        // Green (ACI 3)
  opacity: 1.0
};

// ============================================================================
// HELPER: CREATE MODE-SPECIFIC DEFAULTS
// ============================================================================

function createModeSpecificDefaults<T extends Record<string, unknown>>(
  normal: Partial<T>,
  draft: Partial<T>,
  hover: Partial<T>,
  selection: Partial<T>,
  completion: Partial<T>
): Record<StorageMode, Partial<T>> {
  return {
    normal,
    draft,
    hover,
    selection,
    completion
  };
}

function createEmptyOverrides<T>(): Record<StorageMode, Partial<T>> {
  return {
    normal: {},
    draft: {},
    hover: {},
    selection: {},
    completion: {}
  };
}

function createOverrideFlags(): Record<StorageMode, boolean> {
  return {
    normal: false,
    draft: false,
    hover: false,
    selection: false,
    completion: false
  };
}

// ============================================================================
// FACTORY DEFAULTS - COMPLETE STATE
// ============================================================================

/**
 * Complete factory default settings
 *
 * **CRITICAL:** This is the ONLY source of default values
 *
 * Usage:
 * - First app load (no saved settings)
 * - Factory reset
 * - Fallback when validation fails
 * - Migration defaults
 */
export const FACTORY_DEFAULTS: SettingsState = {
  __standards_version: CURRENT_VERSION,

  // Line settings
  line: {
    general: LINE_DEFAULTS,
    specific: createModeSpecificDefaults(
      {},                        // normal: use general
      LINE_DRAFT_DEFAULTS,
      LINE_HOVER_DEFAULTS,
      LINE_SELECTION_DEFAULTS,
      LINE_COMPLETION_DEFAULTS
    ),
    overrides: createEmptyOverrides()
  },

  // Text settings
  text: {
    general: TEXT_DEFAULTS,
    specific: createModeSpecificDefaults(
      {},                        // normal: use general
      TEXT_DRAFT_DEFAULTS,
      TEXT_HOVER_DEFAULTS,
      TEXT_SELECTION_DEFAULTS,
      TEXT_COMPLETION_DEFAULTS
    ),
    overrides: createEmptyOverrides()
  },

  // Grip settings
  grip: {
    general: GRIP_DEFAULTS,
    specific: createModeSpecificDefaults(
      {},                        // normal: use general
      GRIP_DRAFT_DEFAULTS,
      GRIP_HOVER_DEFAULTS,
      GRIP_SELECTION_DEFAULTS,
      GRIP_COMPLETION_DEFAULTS
    ),
    overrides: createEmptyOverrides()
  },

  // Override flags (all disabled by default)
  overrideEnabled: {
    line: createOverrideFlags(),
    text: createOverrideFlags(),
    grip: createOverrideFlags()
  }
};

// ============================================================================
// EXPORT INDIVIDUAL DEFAULTS (FOR TESTING)
// ============================================================================

export const DEFAULT_LINE_SETTINGS = LINE_DEFAULTS;
export const DEFAULT_TEXT_SETTINGS = TEXT_DEFAULTS;
export const DEFAULT_GRIP_SETTINGS = GRIP_DEFAULTS;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Deep clone factory defaults
 *
 * Use this to avoid mutating the original FACTORY_DEFAULTS
 *
 * @returns Fresh copy of factory defaults
 */
export function getFactoryDefaults(): SettingsState {
  return JSON.parse(JSON.stringify(FACTORY_DEFAULTS));
}

/**
 * Reset specific entity to factory defaults
 *
 * @param entity - Entity type to reset
 * @returns Factory defaults for entity
 */
export function getEntityFactoryDefaults(
  entity: 'line' | 'text' | 'grip'
): SettingsState[typeof entity] {
  return JSON.parse(JSON.stringify(FACTORY_DEFAULTS[entity]));
}
