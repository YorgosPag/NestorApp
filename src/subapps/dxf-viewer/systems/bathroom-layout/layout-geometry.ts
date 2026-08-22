/**
 * Bathroom-layout geometry helpers · ADR-638.
 *
 * Thin 2D adapters over the polygon SSoT (`pointInPolygon`, `polygonArea`,
 * `polygonBbox`, `polygonIntersectionAreaMm2`). All millimetres.
 *
 * ADR-789 — μέχρι 2026-08-22 αυτό το module εξήγαγε `lift()` ώστε ο solver και ο scorer
 * να μοιράζονται ΕΝΑ z=0 idiom αντί να το επαναλαμβάνουν. Το SSoT δεν ήταν λάθος· ήταν
 * **περιττό**: οι υποδοχείς δηλώνουν πλέον `PlanarPoint`, οπότε το 2D πολύγωνο μπαίνει
 * αυτούσιο και το lift έσβησε αντί να κεντρικοποιηθεί.
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  pointInPolygon,
  polygonArea,
  polygonBbox,
} from '../../bim/geometry/shared/polygon-utils';
import { polygonIntersectionAreaMm2 } from '../../bim/geometry/shared/polygon-clip-utils';

/** Unsigned area (mm²) of a 2D polygon. */
export function areaOf(poly: readonly Point2D[]): number {
  return polygonArea(poly);
}

/** True when every vertex of `rect` lies inside (or on) the room polygon. */
export function allCornersInside(
  rect: readonly Point2D[],
  room: readonly Point2D[],
): boolean {
  return rect.every((p) => pointInPolygon(p, room));
}

/** Fraction (0..1) of a rect's corners inside the room (cheap containment proxy). */
export function cornerInsideFraction(
  rect: readonly Point2D[],
  room: readonly Point2D[],
): number {
  if (rect.length === 0) return 0;
  let inside = 0;
  for (const p of rect) if (pointInPolygon(p, room)) inside += 1;
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
  return polygonIntersectionAreaMm2(subject, clip);
}

/** Room bounding-box diagonal length (mm) — normaliser for distance scores. */
export function roomDiagonalMm(room: readonly Point2D[]): number {
  const bb = polygonBbox(room);
  return Math.hypot(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
}
