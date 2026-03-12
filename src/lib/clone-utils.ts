/**
 * @module clone-utils
 * @description Canonical deep clone utility — Single Source of Truth (ADR-212 Phase 9)
 *
 * ALL deep clone usage in the app MUST import from here.
 * Re-exported via `@/subapps/dxf-viewer/utils/clone-utils` for backward compatibility.
 */

// ============================================================================
// DEEP CLONE
// ============================================================================

/**
 * Deep-clone a JSON-serializable value via JSON round-trip.
 * Suitable for plain data objects. Does NOT preserve Date instances,
 * Map/Set, functions, or circular references.
 */
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
