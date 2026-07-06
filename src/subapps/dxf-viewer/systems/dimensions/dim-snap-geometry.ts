/**
 * ADR-362 / ADR-378 — Dimension snap-geometry SSoT.
 *
 * Produces the discrete snap points of a dimension's *rendered* geometry — the
 * dim-line feet, its midpoint, the text anchor, and the arc/leader endpoints —
 * so `DimLineSnapEngine` attracts onto the actual on-canvas dimension instead of
 * only the raw def points (which `DimDefPointSnapEngine` already covers).
 *
 * SSoT reuse (no re-derivation): the rendered geometry comes straight from the
 * hit-geometry SSoT (`dim-hit-geometry.ts`), which itself wraps the ONE geometry
 * builder (`buildDimensionGeometry`). Linear/aligned use the lean, style-free
 * `computeDimHitGeometry`; radial/angular/ordinate use `buildVariantHitGeometry`
 * (ISO-129 canonical style, offset-independent for the hit primitives). This is
 * the exact geometry the renderer draws and the hit-test picks — they can never
 * diverge.
 *
 * Coverage per handoff `2026-07-06_dimension-snap-not-attracting` Step 2:
 *   - foot1 / foot2 (dim-line endpoints = arrow feet)
 *   - dim-line midpoint
 *   - text anchor (entity.textMidpoint, else the geometric default)
 *   - angular: arc start / end / midpoint on the dim arc
 *   - radial: leader endpoints + circle/arc center
 * Extension-line origins are the raw def points (owned by DimDefPointSnapEngine),
 * and their far overshoot ends are not industry snap targets (AutoCAD DIMSNAP),
 * so they are intentionally omitted here.
 *
 * baseline / continued need a parent lookup the snap path does not carry, so they
 * fall back to the entity's own persisted text anchor + dim-line reference point.
 *
 * @see systems/dimensions/dim-hit-geometry.ts — the geometry SSoT this wraps
 * @see snapping/engines/DimLineSnapEngine.ts — sole consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DimensionEntity } from '../../types/dimension';
import { pointOnCircle } from '../../rendering/entities/shared/geometry-vector-utils';
import type { DimGeometry } from './dim-geometry-builder';
import { buildVariantHitGeometry, computeDimHitGeometry } from './dim-hit-geometry';

/** Points closer than this (world units) are treated as the same snap target. */
const SNAP_POINT_EPSILON = 1e-6;

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Append `p` unless it is non-finite or a duplicate of an already-collected point. */
function pushUnique(out: Point2D[], p: Point2D | null | undefined): void {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
  for (const q of out) {
    if (Math.abs(q.x - p.x) < SNAP_POINT_EPSILON && Math.abs(q.y - p.y) < SNAP_POINT_EPSILON) return;
  }
  out.push({ x: p.x, y: p.y });
}

/** Collect the rendered snap points of a radial/angular/ordinate geometry. */
function collectVariantSnapPoints(geom: DimGeometry, out: Point2D[]): void {
  pushUnique(out, geom.textAnchor);
  switch (geom.kind) {
    case 'linear': // ordinate → single-arrow leader treated as a straight dim line
      pushUnique(out, geom.dimLine.start);
      pushUnique(out, geom.dimLine.end);
      pushUnique(out, midpoint(geom.dimLine.start, geom.dimLine.end));
      return;
    case 'angular': {
      const { arcCenter, arcRadius, arcStartAngle, arcEndAngle } = geom;
      pushUnique(out, pointOnCircle(arcCenter, arcRadius, arcStartAngle));
      pushUnique(out, pointOnCircle(arcCenter, arcRadius, arcEndAngle));
      pushUnique(out, pointOnCircle(arcCenter, arcRadius, (arcStartAngle + arcEndAngle) / 2));
      return;
    }
    case 'radial': {
      const path = geom.leaderPath;
      if (path.length > 0) {
        pushUnique(out, path[0]);
        pushUnique(out, path[path.length - 1]);
      }
      pushUnique(out, geom.centerPoint);
      return;
    }
    default: {
      const _exhaustive: never = geom;
      void _exhaustive;
    }
  }
}

/**
 * Best lean reference point for a variant with no rendered geometry available in
 * the snap path (baseline/continued need a parent lookup; degenerate builds).
 * `defPoints[2]` is the dim-line reference for chained variants, same as
 * linear/aligned; `defPoints[0]` is the last resort.
 */
function resolveFallbackRefPoint(entity: DimensionEntity): Point2D | null {
  const dp = entity.defPoints;
  if (dp.length > 2 && dp[2]) return { x: dp[2].x, y: dp[2].y };
  if (dp.length > 0 && dp[0]) return { x: dp[0].x, y: dp[0].y };
  return null;
}

/**
 * The rendered dim-line snap points for `entity` (deduped, finite-guarded).
 * Empty only for a dimension with no derivable geometry and no def points.
 */
export function computeDimLineSnapPoints(entity: DimensionEntity): Point2D[] {
  const out: Point2D[] = [];

  // Linear / aligned — lean foot points + text anchor (no style resolution).
  const hit = computeDimHitGeometry(entity);
  if (hit) {
    pushUnique(out, hit.footStart);
    pushUnique(out, hit.footEnd);
    pushUnique(out, midpoint(hit.footStart, hit.footEnd));
    pushUnique(out, hit.textAnchor);
    return out;
  }

  // Radial / angular / ordinate — full rendered geometry via the builder SSoT.
  const geom = buildVariantHitGeometry(entity);
  if (geom) {
    collectVariantSnapPoints(geom, out);
    return out;
  }

  // baseline / continued + degenerate — persisted text anchor + dim-line ref.
  pushUnique(out, entity.textMidpoint);
  pushUnique(out, resolveFallbackRefPoint(entity));
  return out;
}
