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
import { directionToUnitVector, perp, type Vec2 } from '../geometry/stairs/stair-geometry-shared';

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

/**
 * ADR-393 v2 Phase 2 — step count of the first / last flight for the split
 * variants (l-shape / u-shape = `[n1, n2]`, gamma = `[n1, n2, n3]`). Non-split
 * variants have a single conceptual flight → returns 1.
 */
export function flightCount(variant: StairVariantParams, which: 'first' | 'last'): number {
  if (variant.kind === 'l-shape' || variant.kind === 'u-shape') {
    return which === 'first' ? variant.flightSplit[0] : variant.flightSplit[1];
  }
  if (variant.kind === 'gamma') {
    return which === 'first' ? variant.flightSplit[0] : variant.flightSplit[2];
  }
  return 1;
}

/**
 * ADR-393 v2 Phase 2 — return a copy of the variant with the first / last
 * flight's step count replaced. Preserves the discriminant + every other field
 * (cornerStyle, turnDirection, landing data). No-op for non-split variants.
 */
export function setFlightSplitCount(
  variant: StairVariantParams,
  which: 'first' | 'last',
  n: number,
): StairVariantParams {
  if (variant.kind === 'l-shape' || variant.kind === 'u-shape') {
    const [a, b] = variant.flightSplit;
    return which === 'first'
      ? { ...variant, flightSplit: [n, b] as const }
      : { ...variant, flightSplit: [a, n] as const };
  }
  if (variant.kind === 'gamma') {
    const [a, b, c] = variant.flightSplit;
    return which === 'first'
      ? { ...variant, flightSplit: [n, b, c] as const }
      : { ...variant, flightSplit: [a, b, n] as const };
  }
  return variant;
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
 * ADR-393 v2 — point at half the total arc-length of a polyline (the walkline
 * "middle" along the climbing path). For a straight walkline this equals the
 * geometric midpoint; for L/U/Γ multi-segment walklines it lands ON the path
 * (unlike a bbox centre, which can fall in the L-notch outside the stair).
 * Returns `null` for an empty polyline so callers can fall back to params math.
 */
export function polylineArcMidpoint(poly: ReadonlyArray<Point3D>): Point2D | null {
  if (poly.length === 0) return null;
  if (poly.length === 1) return { x: poly[0].x, y: poly[0].y };
  let total = 0;
  for (let i = 1; i < poly.length; i++) {
    total += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
  }
  if (total === 0) return { x: poly[0].x, y: poly[0].y };
  const half = total / 2;
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const segLen = Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
    if (acc + segLen >= half) {
      const t = segLen > 0 ? (half - acc) / segLen : 0;
      return {
        x: poly[i - 1].x + t * (poly[i].x - poly[i - 1].x),
        y: poly[i - 1].y + t * (poly[i].y - poly[i - 1].y),
      };
    }
    acc += segLen;
  }
  const last = poly[poly.length - 1];
  return { x: last.x, y: last.y };
}

/**
 * ADR-393 v2 Phase 2 — unit direction of a polyline's last non-degenerate
 * segment. For a multi-flight stair walkline this is the last flight's travel
 * direction (`u'`), needed to decompose an end-corner drag onto that flight's
 * own axis. Returns `null` for a degenerate / single-point polyline.
 */
export function lastSegmentDir(poly: ReadonlyArray<Point3D>): Vec2 | null {
  for (let i = poly.length - 1; i > 0; i--) {
    const dx = poly[i].x - poly[i - 1].x;
    const dy = poly[i].y - poly[i - 1].y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-9) return { x: dx / len, y: dy / len };
  }
  return null;
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

/**
 * ADR-358 Phase 3d hotfix — convert split-grip ratio into integer step counts.
 * Geometry builders interpret `flightSplit` as `[stepCount1, stepCount2(, 3)]`
 * and call `new Array(n_i)`; a float ratio threw `RangeError: invalid array
 * length`. Round-trip stays for clamping continuity; the persisted shape uses
 * integers summing to the corner-conserving budget.
 */
export function withFlightSplitStepCounts(
  variant: StairVariantParams,
  r: number,
  stepCount: number,
): StairVariantParams {
  if (variant.kind === 'l-shape') {
    const consumed =
      variant.cornerStyle === 'winders' ? Math.max(1, variant.winderCount) : 1;
    const total = Math.max(2, stepCount - consumed);
    const n1 = Math.max(1, Math.min(total - 1, Math.round(r * total)));
    const n2 = total - n1;
    return { ...variant, flightSplit: [n1, n2] as const };
  }
  if (variant.kind === 'u-shape') {
    const total = Math.max(2, stepCount - 1); // 1 landing
    const n1 = Math.max(1, Math.min(total - 1, Math.round(r * total)));
    const n2 = total - n1;
    return { ...variant, flightSplit: [n1, n2] as const };
  }
  if (variant.kind === 'gamma') {
    const total = Math.max(3, stepCount - 2); // 2 landings
    const n1 = Math.max(1, Math.min(total - 2, Math.round(r * total)));
    const remaining = total - n1;
    const n2 = Math.max(1, Math.floor(remaining / 2));
    const n3 = Math.max(1, remaining - n2);
    return { ...variant, flightSplit: [n1, n2, n3] as const };
  }
  return variant;
}
