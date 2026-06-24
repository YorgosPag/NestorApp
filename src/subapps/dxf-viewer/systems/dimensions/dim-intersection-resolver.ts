/**
 * ADR-362 Phase J3 (gap #2) — intersection re-projection for associative dims.
 *
 * Pure helper that re-solves the intersection of two host entities so a
 * dimension def point anchored to `associationType: 'intersection'` follows the
 * geometry (Revit/AutoCAD DIMASSOC=2). Used by `dim-association-service`.
 *
 * SSoT: the intersection math itself is NOT re-implemented here. We delegate to
 * the exported leaf calculators in `snapping/engines/intersection-calculators`
 * (the same functions `IntersectionSnapEngine` uses, built on
 * `GeometricCalculations`). This module only:
 *   1. dispatches the relevant entity-pair calculator, and
 *   2. disambiguates multi-point results (line×circle, circle×circle) by
 *      picking the candidate nearest the previous def point.
 *
 * NOTE (centralization debt, N.0.2): `IntersectionSnapEngine.calculateIntersections`
 * holds a private 20-pair dispatcher. Extracting a shared `intersectEntities(a,b)`
 * into `intersection-calculators.ts` (engine + this module both delegating) is the
 * full SSoT move, but it touches shared snapping code; deferred to avoid a
 * cross-agent conflict in the shared working tree (flagged in pending-ratchet-work).
 *
 * @see snapping/engines/intersection-calculators.ts — intersection math SSoT
 * @see systems/dimensions/dim-association-service.ts — consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { calculateDistance } from '../../rendering/entities/shared/geometry-vector-utils';
import {
  lineLineIntersection,
  lineCircleIntersection,
  circleCircleIntersection,
  polylineLineIntersection,
  polylinePolylineIntersection,
  polylineCircleIntersection,
} from '../../snapping/engines/intersection-calculators';

const LINE_TYPES = new Set(['line']);
const CIRCLE_TYPES = new Set(['circle', 'arc']);
const POLY_TYPES = new Set(['polyline', 'lwpolyline']);

/**
 * Re-solve the intersection of `a` × `b`, returning the candidate point nearest
 * `hint` (the def point's previous position — disambiguates the two solutions of
 * line×circle / circle×circle). Returns `null` when the entities no longer
 * intersect (caller preserves the current def point).
 *
 * Covers the entity pairs an intersection OSNAP realistically produces between
 * two dimensionable curves: line/line, line/circle(arc), circle/circle,
 * polyline/line, polyline/circle, polyline/polyline. Other pairs → `null`.
 */
export function resolveIntersectionDefPoint(
  a: Entity,
  b: Entity,
  hint: Point2D | null,
): Point2D | null {
  const points = collectIntersections(a, b);
  if (points.length === 0) return null;
  if (points.length === 1 || !hint) return points[0];
  return nearestTo(points, hint);
}

function collectIntersections(a: Entity, b: Entity): Point2D[] {
  const ta = a.type.toLowerCase();
  const tb = b.type.toLowerCase();

  if (LINE_TYPES.has(ta) && LINE_TYPES.has(tb)) {
    return lineLineIntersection(a, b).map((r) => r.point);
  }
  if (LINE_TYPES.has(ta) && CIRCLE_TYPES.has(tb)) {
    return lineCircleIntersection(a, b).map((r) => r.point);
  }
  if (CIRCLE_TYPES.has(ta) && LINE_TYPES.has(tb)) {
    return lineCircleIntersection(b, a).map((r) => r.point);
  }
  if (CIRCLE_TYPES.has(ta) && CIRCLE_TYPES.has(tb)) {
    return circleCircleIntersection(a, b).map((r) => r.point);
  }
  if (POLY_TYPES.has(ta) && LINE_TYPES.has(tb)) {
    return polylineLineIntersection(a, b).map((r) => r.point);
  }
  if (LINE_TYPES.has(ta) && POLY_TYPES.has(tb)) {
    return polylineLineIntersection(b, a).map((r) => r.point);
  }
  if (POLY_TYPES.has(ta) && CIRCLE_TYPES.has(tb)) {
    return polylineCircleIntersection(a, b).map((r) => r.point);
  }
  if (CIRCLE_TYPES.has(ta) && POLY_TYPES.has(tb)) {
    return polylineCircleIntersection(b, a).map((r) => r.point);
  }
  if (POLY_TYPES.has(ta) && POLY_TYPES.has(tb)) {
    return polylinePolylineIntersection(a, b).map((r) => r.point);
  }
  return [];
}

function nearestTo(points: readonly Point2D[], hint: Point2D): Point2D {
  let best = points[0];
  let bestDist = calculateDistance(best, hint);
  for (let i = 1; i < points.length; i++) {
    const d = calculateDistance(points[i], hint);
    if (d < bestDist) {
      bestDist = d;
      best = points[i];
    }
  }
  return best;
}
