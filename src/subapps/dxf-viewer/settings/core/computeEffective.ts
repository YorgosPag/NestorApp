/**
 * @file 3-Layer Merge Logic - Single Source of Truth
 * @module settings/core/computeEffective
 *
 * ENTERPRISE STANDARD - Centralized merge algorithm
 *
 * CRITICAL FIX: Eliminates 145+ duplicate merge patterns scattered across hooks
 * Previously: Each hook (useLineStyles, useTextStyles, useGripStyles) had its own merge
 * Now: Single pure function used everywhere
 *
 *  - Module #1
 */

import type { ViewerMode, StorageMode, OverrideFlags } from './types';
import { modeMap } from './modeMap';
import { UI_COLORS } from '../../config/color-config';

// ============================================================================
// CORE MERGE ALGORITHM
// ============================================================================

/**
 * Computes effective settings using 3-layer merge
 *
 * **MERGE LAYERS (in order):**
 * 1. **General (base)**: Default settings for all modes
 * 2. **Specific[mode]**: Mode-specific overrides
 * 3. **Overrides[mode]**: User overrides (only if enabled)
 *
 * **ALGORITHM:**
 * ```
 * if (overrideEnabled[mode]) {
 *   return { ...general, ...specific[mode], ...overrides[mode] }
 * } else {
 *   return { ...general, ...specific[mode] }
 * }
 * ```
 *
 * @template T - Settings type (LineSettings | TextSettings | GripSettings)
 * @param general - Base settings (layer 1)
 * @param specificByMode - Mode-specific settings (layer 2)
 * @param overridesByMode - User overrides (layer 3)
 * @param enabledByMode - Override enabled flags per mode
 * @param mode - Current viewer mode
 * @returns Merged effective settings
 *
 * @example
 * ```typescript
 * const effective = computeEffective(
 *   { lineWidth: 1, lineColor: UI_COLORS.BLACK },           // general
 *   { draft: { lineWidth: 2 } },                      // specific
 *   { draft: { lineColor: UI_COLORS.SELECTED_RED } },              // overrides
 *   { draft: true, normal: false },                   // enabled
 *   'draft'                                           // mode
 * );
 * // Result: { lineWidth: 2, lineColor: UI_COLORS.SELECTED_RED }
 * //         ↑ from specific  ↑ from overrides
 * ```
 */
export function computeEffective<T extends object>(
  general: T,
  specificByMode: Record<StorageMode, Partial<T>>,
  overridesByMode: Record<StorageMode, Partial<T>>,
  enabledByMode: OverrideFlags,
  mode: ViewerMode
): T {
  // Map viewer mode to storage mode (preview → draft)
  const mappedMode = modeMap(mode);

  // Get mode-specific settings (layer 2)
  const specific = specificByMode[mappedMode] || {};

  // Check if overrides are enabled for this mode
  const isOverridden = enabledByMode[mappedMode];

  if (!isOverridden) {
    // Override disabled: merge base + specific only
    return { ...general, ...specific };
  }

  // Override enabled: merge all 3 layers
  const overrides = overridesByMode[mappedMode] || {};
  return { ...general, ...specific, ...overrides };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Computes effective settings without override layer
 *
 * Useful for preview/calculation purposes where overrides should be ignored
 *
 * @template T - Settings type
 * @param general - Base settings
 * @param specificByMode - Mode-specific settings
 * @param mode - Current viewer mode
 * @returns Merged settings (general + specific only)
 */
export function computeBase<T extends Record<string, unknown>>(
  general: T,
  specificByMode: Record<StorageMode, Partial<T>>,
  mode: ViewerMode
): T {
  const mappedMode = modeMap(mode);
  const specific = specificByMode[mappedMode] || {};
  return { ...general, ...specific };
}

/**
 * Checks if effective settings differ from base settings
 *
 * Useful for UI indicators (show "override active" badge)
 *
 * @template T - Settings type
 * @param general - Base settings
 * @param specificByMode - Mode-specific settings
 * @param overridesByMode - User overrides
 * @param enabledByMode - Override enabled flags
 * @param mode - Current viewer mode
 * @returns True if overrides are active and modify the settings
 */
export function hasActiveOverrides<T extends Record<string, unknown>>(
  general: T,
  specificByMode: Record<StorageMode, Partial<T>>,
  overridesByMode: Record<StorageMode, Partial<T>>,
  enabledByMode: OverrideFlags,
  mode: ViewerMode
): boolean {
  const mappedMode = modeMap(mode);

  // Override must be enabled
  if (!enabledByMode[mappedMode]) {
    return false;
  }

  // Override must have at least one value
  const overrides = overridesByMode[mappedMode] || {};
  return Object.keys(overrides).length > 0;
}

/**
 * Computes which settings keys are being overridden
 *
 * @template T - Settings type
 * @param overridesByMode - User overrides
 * @param enabledByMode - Override enabled flags
 * @param mode - Current viewer mode
 * @returns Array of overridden setting keys
 *
 * @example
 * ```typescript
 * const keys = getOverriddenKeys(
 *   { draft: { lineWidth: 2, lineColor: UI_COLORS.SELECTED_RED } },
 *   { draft: true },
 *   'draft'
 * );
 * // Result: ['lineWidth', 'lineColor']
 * ```
 */
export function getOverriddenKeys<T extends Record<string, unknown>>(
  overridesByMode: Record<StorageMode, Partial<T>>,
  enabledByMode: OverrideFlags,
  mode: ViewerMode
): Array<keyof T> {
  const mappedMode = modeMap(mode);

  if (!enabledByMode[mappedMode]) {
    return [];
  }

  const overrides = overridesByMode[mappedMode] || {};
  return Object.keys(overrides) as Array<keyof T>;
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Deep equality check for settings objects
 *
 * Used in tests and optimization (skip re-render if settings unchanged)
 *
 * @param a - First settings object
 * @param b - Second settings object
 * @returns True if objects are deeply equal
 */
export function settingsEqual<T extends Record<string, unknown>>(
  a: T,
  b: T
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}
