/**
 * @file Clone Utilities - Single Source of Truth
 * @module utils/clone-utils
 *
 * 🏢 ADR-101: Centralized Deep Clone Utility
 *
 * Single Source of Truth για deep cloning operations.
 * Replaces scattered JSON.parse(JSON.stringify()) patterns.
 *
 * **PURPOSE:**
 * - Centralize all deep clone operations
 * - Eliminate duplicate inline patterns
 * - Provide type-safe cloning API
 *
 * **USAGE:**
 * ```typescript
 * import { deepClone } from '../utils/clone-utils';
 *
 * // Clone any serializable value
 * const copy = deepClone(entity);
 * const polygonCopy = deepClone(overlay.polygon);
 * ```
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-101
 */

/**
 * Deep clone any serializable value
 *
 * Uses JSON serialization for reliable deep copying.
 * Suitable for: Objects, Arrays, primitives, nested structures.
 *
 * ⚠️ LIMITATIONS (by design - matches existing behavior):
 * - Does not clone: undefined, functions, Symbols, circular references
 * - Date objects become strings
 * - Map/Set become empty objects
 *
 * @template T - Type of value to clone
 * @param value - Value to clone (must be JSON-serializable)
 * @returns Deep copy of the value
 *
 * @example
 * // Clone entity snapshot for undo
 * const snapshot = deepClone(entity);
 *
 * @example
 * // Clone polygon vertices for drag
 * const startPolygon = deepClone(overlay.polygon);
 *
 * @example
 * // Clone factory defaults
 * const defaults = deepClone(FACTORY_DEFAULTS);
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
