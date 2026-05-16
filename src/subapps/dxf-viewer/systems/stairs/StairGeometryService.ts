/**
 * ADR-358 Phase 3a — `StairGeometryService` entry point.
 *
 * Pure functions (no DOM / React / DXF deps). Dispatch on `StairParams.variant.kind`.
 * Phase 3a implements ONLY `'straight'` + `'l-shape'`. The remaining 9 kinds throw
 * sentinel errors — Phase 3b/4a/4b/4c will replace them incrementally as they
 * register kind-specific computers.
 *
 * Conventions (shared with Phase 2a/2b):
 *   - Plan view: +X right, +Y up. ccw rotation = positive angle (math frame).
 *   - All linear inputs in mm (storage canonical per §5.0).
 *   - Tread polygon at z = i·rise (i = 0..stepCount−1) — vertices co-planar, CCW.
 *   - Riser i (between treads i and i+1) is the vertical edge segment.
 *   - Walkline = polyline of waist-line of the flight (Polyline3D).
 *   - Stringers = parallel-offset of walkline at ±width/2 (uses Phase 2b SSoT).
 *   - cutPlaneHeight default 1200 mm (§5.1 Q21). When `params.cutPlaneHeight` is
 *     undefined the default applies. cutLine is emitted only when the cut plane
 *     actually splits the stair (both below/above lists non-empty).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §5.3 §6.2 §6.3
 */

import { offsetPolyline } from '../../rendering/entities/shared/geometry-offset-utils';
import type { StairGeometry, StairParams, Polygon3D, Polyline3D, Segment3D } from '../../types/stair';
import {
  DEFAULT_CUT_PLANE_HEIGHT,
  type Vec2,
  perp,
  directionToUnitVector,
  point,
  rectangleAt,
  arrowSymbol,
  bboxOfPolygons,
  splitTreadsByCutPlane,
  buildCutLine,
  buildStringersFromWalkline,
} from './stair-geometry-shared';
import { computeLShape } from './stair-geometry-lshape';

// ─── Public entry point (kind dispatch) ──────────────────────────────────────

/**
 * Compute the cached `StairGeometry` from a parametric `StairParams`. Dispatches
 * on `params.variant.kind`. Phase 3a covers `'straight'` and `'l-shape'`; other
 * kinds throw with a sentinel that subsequent phases replace.
 */
export function computeStairGeometry(params: Readonly<StairParams>): StairGeometry {
  const variant = params.variant;
  switch (variant.kind) {
    case 'straight':
      return computeStraight(params);
    case 'l-shape':
      return computeLShape(params, variant);
    case 'u-shape':
    case 'gamma':
      throw new Error(
        `StairGeometryService: kind '${variant.kind}' not implemented yet (Phase 3b)`,
      );
    case 'spiral':
    case 'helical':
      throw new Error(
        `StairGeometryService: kind '${variant.kind}' not implemented yet (Phase 4a)`,
      );
    case 'elliptical':
    case 'winder':
      throw new Error(
        `StairGeometryService: kind '${variant.kind}' not implemented yet (Phase 4b)`,
      );
    case 'triangular-fan':
    case 'triangular-outline':
    case 'sketch':
      throw new Error(
        `StairGeometryService: kind '${variant.kind}' not implemented yet (Phase 4c)`,
      );
    default: {
      const _exhaustive: never = variant;
      throw new Error(`StairGeometryService: unhandled variant ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Walkline from a centerline polyline by parallel offset. Re-exported helper —
 * Phase 4a/4b services pass curved centerlines (helix/spiral samples) and want
 * the walkline offset by `params.walklineOffset` from the inner edge.
 *
 * Reuses Phase 2b `offsetPolyline` — no parallel-offset duplicate in this file.
 */
export function computeWalkline(centerline: Polyline3D, offset: number): Polyline3D {
  return offsetPolyline(centerline, offset);
}

// ─── STRAIGHT ────────────────────────────────────────────────────────────────

function computeStraight(params: Readonly<StairParams>): StairGeometry {
  const { basePoint, direction, rise, tread, nosing, width, stepCount, upDirection } = params;
  const u = directionToUnitVector(direction);
  const treads = buildStraightTreads(basePoint, u, rise, tread, nosing, width, stepCount);
  const risers = buildStraightRisers(basePoint, u, rise, tread, width, stepCount);
  const walkline = buildStraightWalkline(basePoint, u, tread, rise, stepCount);
  const stringers = buildStringersFromWalkline(walkline, width);
  const totalRun = tread * (stepCount - 1);
  const arrow = arrowSymbol(
    basePoint,
    point(basePoint.x + u.x * totalRun, basePoint.y + u.y * totalRun, basePoint.z),
    upDirection,
  );
  const cutPlaneHeight = params.cutPlaneHeight ?? DEFAULT_CUT_PLANE_HEIGHT;
  const split = splitTreadsByCutPlane(treads, cutPlaneHeight);
  const cutLine =
    split.below.length > 0 && split.above.length > 0
      ? buildCutLine(split.above[0], u, width, cutPlaneHeight)
      : undefined;
  return {
    treads: split.below,
    treadsBelowCut: split.below,
    treadsAboveCut: split.above,
    risers,
    stringers,
    walkline,
    handrails: {},
    landings: [],
    arrowSymbol: arrow,
    cutLine,
    bbox: bboxOfPolygons(treads),
  };
}

function buildStraightTreads(
  basePoint: Readonly<{ x: number; y: number; z: number }>,
  u: Vec2,
  rise: number,
  tread: number,
  nosing: number,
  width: number,
  stepCount: number,
): readonly Polygon3D[] {
  const v = perp(u);
  const halfW = width * 0.5;
  const depth = tread + nosing;
  const out: Polygon3D[] = new Array(stepCount);
  for (let i = 0; i < stepCount; i++) {
    const baseAlong = tread * i;
    const corner: Vec2 = {
      x: basePoint.x + u.x * baseAlong - v.x * halfW,
      y: basePoint.y + u.y * baseAlong - v.y * halfW,
    };
    out[i] = rectangleAt(corner, u, depth, width, basePoint.z + rise * i);
  }
  return out;
}

function buildStraightRisers(
  basePoint: Readonly<{ x: number; y: number; z: number }>,
  u: Vec2,
  rise: number,
  tread: number,
  width: number,
  stepCount: number,
): readonly Segment3D[] {
  const v = perp(u);
  const halfW = width * 0.5;
  const out: Segment3D[] = [];
  for (let i = 0; i < stepCount - 1; i++) {
    const along = tread * (i + 1);
    const cx = basePoint.x + u.x * along;
    const cy = basePoint.y + u.y * along;
    const zLow = basePoint.z + rise * i;
    const zHigh = basePoint.z + rise * (i + 1);
    out.push({
      start: point(cx - v.x * halfW, cy - v.y * halfW, zLow),
      end: point(cx - v.x * halfW, cy - v.y * halfW, zHigh),
    });
  }
  return out;
}

function buildStraightWalkline(
  basePoint: Readonly<{ x: number; y: number; z: number }>,
  u: Vec2,
  tread: number,
  rise: number,
  stepCount: number,
): Polyline3D {
  const run = tread * (stepCount - 1);
  return [
    point(basePoint.x, basePoint.y, basePoint.z),
    point(
      basePoint.x + u.x * run,
      basePoint.y + u.y * run,
      basePoint.z + rise * (stepCount - 1),
    ),
  ];
}
