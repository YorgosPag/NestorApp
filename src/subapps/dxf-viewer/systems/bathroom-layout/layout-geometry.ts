/**
 * Bathroom-layout geometry helpers · ADR-638.
 *
 * Thin 2D adapters over the polygon SSoT (`pointInPolygon`, `polygonArea`,
 * `polygonBbox`, `polygonIntersectionAreaMm2`) so the solver + scorer share ONE
 * lift-to-3D idiom instead of repeating `p => ({...p, z:0})` (N.0.2 / N.18). All
 * millimetres.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  pointInPolygon,
  polygonArea,
  polygonBbox,
} from '../../bim/geometry/shared/polygon-utils';
import { polygonIntersectionAreaMm2 } from '../../bim/geometry/shared/polygon-clip-utils';

/** Lift a 2D ring to the z=0 plane (fresh objects, never aliases input). */
export function lift(poly: readonly Point2D[]): Point3D[] {
  return poly.map((p) => ({ x: p.x, y: p.y, z: 0 }));
}

/** Unsigned area (mm²) of a 2D polygon. */
export function areaOf(poly: readonly Point2D[]): number {
  return polygonArea(lift(poly));
}

/** True when every vertex of `rect` lies inside (or on) the room polygon. */
export function allCornersInside(
  rect: readonly Point2D[],
  roomLifted: readonly Point3D[],
): boolean {
  return rect.every((p) => pointInPolygon(p, roomLifted));
}

/** Fraction (0..1) of a rect's corners inside the room (cheap containment proxy). */
export function cornerInsideFraction(
  rect: readonly Point2D[],
  roomLifted: readonly Point3D[],
): number {
  if (rect.length === 0) return 0;
  let inside = 0;
  for (const p of rect) if (pointInPolygon(p, roomLifted)) inside += 1;
  return inside / rect.length;
}

/**
 * Intersection area (mm²) of two CONVEX rectangles. `clip` (2nd arg) must be
 * convex CCW — fixture footprints/use-zones always are (built by `buildFixtureRects`).
 */
export function rectOverlapMm2(
  subject: readonly Point2D[],
  clip: readonly Point2D[],
): number {
  return polygonIntersectionAreaMm2(lift(subject), lift(clip));
}

/** Room bounding-box diagonal length (mm) — normaliser for distance scores. */
export function roomDiagonalMm(roomLifted: readonly Point3D[]): number {
  const bb = polygonBbox(roomLifted);
  return Math.hypot(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
}
