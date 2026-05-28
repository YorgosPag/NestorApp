/**
 * ADR-358 Phase 5b + ADR-393 — Shared math/constants for stair grip handlers.
 *
 * Pure helpers used by BOTH the grip-position computation (`stair-grips.ts`)
 * and the grip-drag transforms (`stair-grip-transforms.ts`). Extracted into a
 * standalone module so neither consumer grows past the 500-line file ceiling
 * (N.7.1) and so the vector/scalar helpers stay a single source of truth.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-393-bim-stair-extended-grips.md
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.12
 */

import type { Point2D, Point3D } from '../../rendering/types/Types';
import type { StairVariantParams } from '../../bim/types/stair-types';
import { directionToUnitVector, perp } from '../geometry/stairs/stair-geometry-shared';

export const RAD_TO_DEG = 180 / Math.PI;
export const DIRECTION_GRIP_OFFSET_MM = 100; // §5.12 — direction handle at basePoint + 100mm·u
export const MIN_WIDTH_MM = 50;
export const MIN_STEP_COUNT = 2;
export const MIN_FLIGHT_SPLIT_RATIO = 0.1;
export const MAX_FLIGHT_SPLIT_RATIO = 0.9;

// ADR-358 Phase 9B-2 — magnet snap zone for the length grip when linked to a
// floor: once the cursor enters the last 10% of the max run, the grip jumps to
// maxRun exactly (Revit / ArchiCAD "magnet to top level" behaviour).
export const LINKED_LENGTH_SNAP_RATIO = 0.9;

// ─── Variants that expose a split / per-flight / landing grip ────────────────

export const SPLIT_GRIP_KINDS = new Set(['l-shape', 'u-shape', 'gamma']);

export function hasSplitGrip(variant: StairVariantParams): boolean {
  return SPLIT_GRIP_KINDS.has(variant.kind);
}

// ─── Direction helpers ───────────────────────────────────────────────────────
// SSoT: the unit-vector + CCW-perpendicular math lives in `stair-geometry-shared`
// (consumed by the geometry builders). Re-exported here under the grip-module
// names so callers keep a single import surface and we do NOT re-implement the
// identical `{cos,sin}` / `(-y,x)` formulas (ADR-393 / N.0.2 SSoT).

export const unitVectorFromDirection = directionToUnitVector;
export const perpUnit = perp;

export function project2D(p3: Point3D): Point2D {
  return { x: p3.x, y: p3.y };
}

export function polygonCentroid2D(polygon: ReadonlyArray<Point3D>): Point2D {
  let sx = 0;
  let sy = 0;
  for (const v of polygon) { sx += v.x; sy += v.y; }
  const n = polygon.length;
  return { x: sx / n, y: sy / n };
}

/**
 * Pick a 50 mm min-width floor in whatever scene units the current value is
 * expressed in. Heuristic mirror of `detectSceneUnits(bounds)` but per single
 * value: a width default of 1.2 (m), 120 (cm), 1200 (mm) → respective floors
 * 0.05, 5, 50 — same physical 50 mm in every case.
 *
 * Without scaling, `MIN_WIDTH_MM = 50` clamped a metre-scale stair to 50 m
 * because `Math.max(50, 1.2) = 50`.
 */
export function minWidthFloorFor(currentWidth: number): number {
  if (!Number.isFinite(currentWidth) || currentWidth <= 0) return MIN_WIDTH_MM;
  if (currentWidth < 10) return 0.05;   // metres
  if (currentWidth < 100) return 5;     // centimetres
  return MIN_WIDTH_MM;                  // millimetres (or larger units → safe)
}
