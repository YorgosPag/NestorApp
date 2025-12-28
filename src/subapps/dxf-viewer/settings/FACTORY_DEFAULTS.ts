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
import { UI_COLORS } from '../config/color-config';

// ============================================================================
// CURRENT SCHEMA VERSION
// ============================================================================

/**
 * Current settings schema version
 *
 * **INCREMENT THIS** when making breaking changes to settings structure
 *
 * ✅ FIX v2: Property name migration (lineColor→color, lineStyle→lineType, textColor→color,
 *            size→gripSize, color/hoverColor→colors{cold,warm,hot,contour})
 * ✅ FIX v3: FontWeight type migration (string→number) - ChatGPT5 fix
 */
export const CURRENT_VERSION = 3;

// ============================================================================
// LINE SETTINGS DEFAULTS
// ============================================================================

const LINE_DEFAULTS = {
  enabled: true,                // ✅ FIX: Added enabled property (for LinePreview)
  lineWidth: 0.25,              // 0.25mm (ISO 128 standard)
  color: ACI_PALETTE[7] as string,        // White (ACI 7) - ✅ FIX: renamed from lineColor
  lineType: 'solid' as const,             // ✅ FIX: renamed from lineStyle
  opacity: 1.0
};

const LINE_DRAFT_DEFAULTS = {
  lineWidth: 0.18,              // Thinner for draft
  color: ACI_PALETTE[8] as string,        // Gray (ACI 8) - ✅ FIX: renamed from lineColor
  lineType: 'dashed' as const,            // ✅ FIX: renamed from lineStyle
  opacity: 0.7                   // Slightly transparent
};

const LINE_HOVER_DEFAULTS = {
  color: ACI_PALETTE[4] as string,        // Cyan (ACI 4) for hover - ✅ FIX: renamed from lineColor
  opacity: 1.0
};

const LINE_SELECTION_DEFAULTS = {
  color: ACI_PALETTE[1] as string,        // Red (ACI 1) for selection - ✅ FIX: renamed from lineColor
  lineWidth: 0.35,              // Thicker for visibility
  opacity: 1.0
};

const LINE_COMPLETION_DEFAULTS = {
  color: ACI_PALETTE[3] as string,        // Green (ACI 3) for completion - ✅ FIX: renamed from lineColor
  opacity: 1.0
};

// ============================================================================
// TEXT SETTINGS DEFAULTS
// ============================================================================

const TEXT_DEFAULTS = {
  enabled: true,                // ✅ FIX: Added enabled property (for LinePreview)
  fontSize: 12,                 // 12pt (standard CAD text)
  fontFamily: 'Arial',          // Sans-serif (CAD standard)
  fontWeight: 400,              // ✅ FIX: Changed from 'normal' to 400 (number)
  fontStyle: 'normal' as const,
  color: ACI_PALETTE[7] as string,        // White (ACI 7) - ✅ FIX: renamed from textColor
  opacity: 1.0
};

const TEXT_DRAFT_DEFAULTS = {
  fontSize: 10,                 // Smaller for draft
  color: ACI_PALETTE[8] as string,        // Gray (ACI 8) - ✅ FIX: renamed from textColor
  opacity: 0.7
};

const TEXT_HOVER_DEFAULTS = {
  color: ACI_PALETTE[4] as string,        // Cyan (ACI 4) - ✅ FIX: renamed from textColor
  opacity: 1.0
};

const TEXT_SELECTION_DEFAULTS = {
  color: ACI_PALETTE[1] as string,        // Red (ACI 1) - ✅ FIX: renamed from textColor
  fontWeight: 700,              // ✅ FIX: Changed from 'bold' to 700 (number)
  opacity: 1.0
};

const TEXT_COMPLETION_DEFAULTS = {
  color: ACI_PALETTE[3] as string,        // Green (ACI 3) - ✅ FIX: renamed from textColor
  opacity: 1.0
};

// ============================================================================
// GRIP SETTINGS DEFAULTS
// ============================================================================

const GRIP_DEFAULTS = {
  enabled: true,                // ✅ FIX: Added enabled property (for LinePreview)
  gripSize: 8,                  // 8px (standard CAD grip) - ✅ FIX: renamed from size
  pickBoxSize: 3,               // ✅ FIX: Added pickBoxSize (AutoCAD PICKBOX default: 3 DIP)
  apertureSize: 10,             // ✅ FIX: Added apertureSize (AutoCAD APERTURE default: 10 pixels)
  colors: {                     // ✅ FIX: changed from flat color/hoverColor to nested structure
    cold: ACI_PALETTE[5] as string,       // Blue (ACI 5)
    warm: ACI_PALETTE[4] as string,       // Cyan (ACI 4) on hover
    hot: ACI_PALETTE[1] as string,        // Red (ACI 1) on selection
    contour: UI_COLORS.BLACK              // Black contour
  },
  shape: 'square' as const,     // Square (CAD standard)
  opacity: 1.0,
  showAperture: true,           // ✅ FIX: Added showAperture (AutoCAD APBOX default: enabled)
  multiGripEdit: true,          // ✅ FIX: Added multiGripEdit (multi-grip editing enabled)
  snapToGrips: true,            // ✅ FIX: Added snapToGrips (snap to grips enabled)
  showMidpoints: true,          // ✅ FIX: Added showMidpoints (show midpoint grips)
  showCenters: true,            // ✅ FIX: Added showCenters (show center grips)
  showQuadrants: true,          // ✅ FIX: Added showQuadrants (show quadrant grips)
  maxGripsPerEntity: 50         // ✅ FIX: Added maxGripsPerEntity (default max grips)
};

const GRIP_DRAFT_DEFAULTS = {
  gripSize: 6,                  // Smaller for draft - ✅ FIX: renamed from size
  opacity: 0.7
};

const GRIP_HOVER_DEFAULTS = {
  gripSize: 10,                 // Larger on hover - ✅ FIX: renamed from size
  opacity: 1.0
};

const GRIP_SELECTION_DEFAULTS = {
  colors: {                     // ✅ FIX: changed from flat color to nested structure
    hot: ACI_PALETTE[1] as string         // Red (ACI 1)
  },
  gripSize: 10,                 // ✅ FIX: renamed from size
  opacity: 1.0
};

const GRIP_COMPLETION_DEFAULTS = {
  colors: {                     // ✅ FIX: changed from flat color to nested structure
    cold: ACI_PALETTE[3] as string        // Green (ACI 3)
  },
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
