/**
 * SCALAR MATH — neutral, dependency-free scalar clamp primitives.
 *
 * Canonical SSoT for the `clamp` family (ADR-071). Promoted here from
 * `rendering/entities/shared/geometry-utils.ts` so that low-level, non-render
 * consumers (config/, bim/, bim-3d/, snapping/, systems/, hooks/, io/) can use
 * the same clamp without importing the rendering layer (dependency inversion).
 *
 * This module MUST stay dependency-free (no imports) — it is the bottom of the
 * math stack. `geometry-utils.ts` re-exports these for backward-compat.
 */

/**
 * Clamp a value to the [min, max] range.
 * @example clamp(150, 0, 100) // → 100
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp a value to the [0, 1] range (opacity / alpha / percentage / parametric t).
 * @example clamp01(1.5) // → 1
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Clamp a value to the [0, 255] range (RGB colour components).
 * @example clamp255(300) // → 255
 */
export function clamp255(value: number): number {
  return Math.max(0, Math.min(255, value));
}
