/**
 * ADR-363 — Wall height/thickness read/edit pure helpers (meters I/O).
 *
 * Companion to `wall-length-edit.ts`. `height`/`thickness` are stored in mm
 * (SSoT, always mm regardless of sceneUnits) — so meters conversion is a plain
 * ×1000 / ÷1000, NO sceneUnits scale (the legacy ribbon bridge
 * `wall-param-helpers` incorrectly applied the scale → corrupt display/write in
 * non-mm scenes). Writers return a `Partial<WallParams>` patch or `null` when
 * the value is unchanged / invalid so the caller can skip a no-op dispatch.
 *
 * Zero React / DOM / Firestore deps. Geometry recompute stays the caller's
 * responsibility via `UpdateWallParamsCommand`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3
 */

import type { WallParams } from '../types/wall-types';
import { MIN_WALL_THICKNESS_MM, MAX_WALL_THICKNESS_MM } from '../types/wall-types';

const MM_PER_M = 1000;
/** Minimum wall height (mm) — sanity floor; the validator owns code-compliance. */
const MIN_WALL_HEIGHT_MM = 1;
const EPS_MM = 1e-6;

export function getWallHeightMeters(params: WallParams): number {
  return params.height / MM_PER_M;
}

export function setWallHeightMeters(
  params: WallParams,
  meters: number,
): Partial<WallParams> | null {
  if (!Number.isFinite(meters)) return null;
  const mm = Math.max(MIN_WALL_HEIGHT_MM, meters * MM_PER_M);
  if (Math.abs(mm - params.height) < EPS_MM) return null;
  return { height: mm };
}

export function getWallThicknessMeters(params: WallParams): number {
  return params.thickness / MM_PER_M;
}

export function setWallThicknessMeters(
  params: WallParams,
  meters: number,
): Partial<WallParams> | null {
  if (!Number.isFinite(meters)) return null;
  const mm = Math.min(
    MAX_WALL_THICKNESS_MM,
    Math.max(MIN_WALL_THICKNESS_MM, meters * MM_PER_M),
  );
  if (Math.abs(mm - params.thickness) < EPS_MM) return null;
  // Drop dna so the validator does not fire `dnaThicknessMismatch` against the
  // legacy preset (parity with wall-param-helpers + wall-grip-transforms).
  return { thickness: mm, dna: undefined };
}
