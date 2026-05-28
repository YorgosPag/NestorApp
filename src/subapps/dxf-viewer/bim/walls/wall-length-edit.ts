/**
 * ADR-363 — Wall length read/edit pure helpers.
 *
 * Editable axis-length surface for the contextual Wall ribbon (meters I/O).
 * Length is NOT a `WallParams` field — it is derived from `start`/`end`. Read
 * mirrors `computeWallGeometry`'s length formula (canvas → m); write moves the
 * `end` endpoint along the current axis direction, keeping `start` + bearing
 * anchored (Revit "location line" length edit). Geometry recompute stays the
 * caller's responsibility via `UpdateWallParamsCommand`.
 *
 * Zero React / DOM / Firestore deps. Mirrors `wall-grip-transforms.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3
 */

import type { WallParams } from '../types/wall-types';
import { MIN_WALL_LENGTH_MM } from '../types/wall-types';
import type { Point3D } from '../types/bim-base';
import { mmScaleFor } from '../../utils/scene-units';
import { unitAxis } from './wall-grip-math';

const MM_PER_M = 1000;

/**
 * Geometric axis length in meters. Matches `computeWallGeometry().length`
 * (canvas units → m via the scene-units scale). Returns 0 for degenerate scale.
 */
export function getWallLengthMeters(params: WallParams): number {
  const s = mmScaleFor(params);
  if (!Number.isFinite(s) || s <= 0) return 0;
  const lengthCanvas = Math.hypot(
    params.end.x - params.start.x,
    params.end.y - params.start.y,
  );
  return lengthCanvas / s / MM_PER_M;
}

/**
 * Set the axis length to `meters` by moving `end` along the start→end direction.
 * `start` + bearing stay anchored. Length is clamped to `MIN_WALL_LENGTH_MM`.
 * Returns `null` for a degenerate axis (start ≈ end) or non-finite input so the
 * caller can skip the dispatch.
 */
export function setWallLengthMeters(
  params: WallParams,
  meters: number,
): WallParams | null {
  if (!Number.isFinite(meters)) return null;
  const u = unitAxis(params);
  if (!u) return null;
  const s = mmScaleFor(params);
  const lengthMm = Math.max(MIN_WALL_LENGTH_MM, meters * MM_PER_M);
  const lengthCanvas = lengthMm * s;
  const end: Point3D = {
    x: params.start.x + u.x * lengthCanvas,
    y: params.start.y + u.y * lengthCanvas,
    z: params.end.z,
  };
  return { ...params, end };
}
