/**
 * @file Mode Mapping - Single Source of Truth
 * @module settings/core/modeMap
 *
 * ENTERPRISE STANDARD - Centralized mode mapping logic
 *
 * CRITICAL FIX: Eliminates hardcoded 'draft' mode scattered across codebase
 * Previously: 15+ instances of `mode === 'preview' ? 'draft' : mode`
 * Now: Single function call
 *
 *  - Bug #2
 */

import type { ViewerMode, StorageMode } from './types';

// ============================================================================
// MODE MAPPING
// ============================================================================

/**
 * Maps viewer mode to storage mode
 *
 * **RULE:** 'preview' mode is always stored as 'draft'
 *
 * This is the ONLY place where mode mapping happens.
 * All other code MUST use this function.
 *
 * @param mode - Current viewer mode
 * @returns Storage mode (never 'preview')
 *
 * @example
 * ```typescript
 * modeMap('preview')    // → 'draft'
 * modeMap('normal')     // → 'normal'
 * modeMap('selection')  // → 'selection'
 * ```
 */
export function modeMap(mode: ViewerMode): StorageMode {
  return mode === 'preview' ? 'draft' : mode;
}

// ============================================================================
// MODE VALIDATION
// ============================================================================

/**
 * Validates that a mode is suitable for storage
 *
 * @param mode - Mode to validate
 * @returns True if mode can be stored directly (not 'preview')
 */
export function isStorageMode(mode: ViewerMode): mode is StorageMode {
  return mode !== 'preview';
}

/**
 * Ensures mode is safe for storage (maps if needed)
 *
 * Same as modeMap but with explicit validation
 *
 * @param mode - Viewer mode
 * @returns Storage-safe mode
 */
export function ensureStorageMode(mode: ViewerMode): StorageMode {
  if (mode === 'preview') {
    return 'draft';
  }
  return mode;
}
