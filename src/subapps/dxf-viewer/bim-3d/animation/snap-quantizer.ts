'use client';

/**
 * ADR-366 §C.1.b — Waypoint snap-to-grid quantizer.
 *
 * Pure math helper: rounds each axis of a Vec3 to the nearest multiple of
 * `step`. Origin defaults to (0,0,0) — all snapping is relative to world origin.
 *
 * Blender/Maya/AutoCAD convention: snap rounds each axis independently.
 * `step ≤ 0` is a no-op (safety guard against division by zero).
 */

export interface SnapVec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Round each axis of `v` to the nearest multiple of `step` relative to
 * `origin` (defaults to world origin). Returns `v` unchanged when `step ≤ 0`.
 */
export function quantizeVec3(
  v: SnapVec3,
  step: number,
  origin: SnapVec3 = { x: 0, y: 0, z: 0 },
): SnapVec3 {
  if (step <= 0) return v;
  return {
    x: Math.round((v.x - origin.x) / step) * step + origin.x,
    y: Math.round((v.y - origin.y) / step) * step + origin.y,
    z: Math.round((v.z - origin.z) / step) * step + origin.z,
  };
}

/** Preset step values (scene units) offered in the ribbon combobox. */
export const SNAP_STEP_PRESETS = [0.1, 0.25, 0.5, 1.0, 2.0] as const;
export type SnapStepPreset = (typeof SNAP_STEP_PRESETS)[number];

/** Default step when snap is first enabled. */
export const DEFAULT_SNAP_STEP = 0.5;
