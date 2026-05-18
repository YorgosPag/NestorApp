/**
 * Wall Axis Projection — pure SSoT για ADR-363 Phase 5.5e.
 *
 * Snap-to-wall-axis perpendicular projection (Revit "Snap to Reference Line").
 * Όταν cursor κουμπώνει κοντά σε wall axis (όχι σε wall endpoint/midpoint), τα
 * `NearestSnapEngine` + `PerpendicularSnapEngine` καταναλώνουν αυτό το module
 * ώστε beam-start/beam-end (ή οποιοδήποτε drawing tool με snap) να προβάλλει
 * τον cursor πάνω στον axis του τοίχου.
 *
 * Δεν αναπαράγει Bezier maths: διαβάζει `wall.geometry.axisPolyline.points`
 * που είναι ήδη cached από `computeWallGeometry()` (Phase 1). Όλα τα wall kinds
 * (straight=2 vertices, curved=N+1 tessellated, polyline=user vertices) λύνονται
 * uniformly σαν polyline projection.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.5e
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';

/**
 * Κλειστά clamped foot — closest point πάνω στον axis polyline του τοίχου.
 * Σημασιολογία **NEAREST**: foot clamped στο εκάστοτε segment, ώστε αν cursor
 * πέσει πέρα από τον τελευταίο vertex, το αποτέλεσμα είναι το endpoint (όχι
 * προέκταση).
 *
 * Επιστρέφει `null` εάν το wall δεν έχει cached geometry ή λιγότερους από 2
 * vertices στον axis (defensive — Phase 1 invariant guarantees presence).
 */
export function projectPointOnWallAxis(
  wall: WallEntity,
  cursor: Point2D,
): Point2D | null {
  const points = wall.geometry?.axisPolyline?.points;
  if (!points || points.length < 2) return null;

  let closest: Point2D | null = null;
  let closestDistance = Infinity;

  for (let i = 1; i < points.length; i++) {
    const a: Point2D = { x: points[i - 1].x, y: points[i - 1].y };
    const b: Point2D = { x: points[i].x, y: points[i].y };
    const foot = getNearestPointOnLine(cursor, a, b, true);
    const d = calculateDistance(cursor, foot);
    if (d < closestDistance) {
      closestDistance = d;
      closest = foot;
    }
  }

  return closest;
}

/**
 * Unclamped feet — ένα foot ανά segment, υπολογισμένο στην infinite line
 * extension του εκάστοτε segment. Σημασιολογία **PERPENDICULAR** (AutoCAD/
 * Revit): καλύπτει την περίπτωση όπου ο user θέλει ορθογώνια προβολή στην
 * προέκταση του τοίχου (cursor πέρα από wall endpoint).
 *
 * Filtered by `maxDistance` (snap radius σε world units). Returns όλα τα
 * candidate feet — ο engine αναλαμβάνει final pick με `findEntityBasedSnapCandidates`.
 *
 * Returns κενό array εάν geometry missing ή κανένα foot εντός radius.
 */
export function getWallAxisPerpendicularFeet(
  wall: WallEntity,
  cursor: Point2D,
  maxDistance: number,
): Array<{ point: Point2D; segmentIndex: number }> {
  const points = wall.geometry?.axisPolyline?.points;
  if (!points || points.length < 2) return [];

  const feet: Array<{ point: Point2D; segmentIndex: number }> = [];

  for (let i = 1; i < points.length; i++) {
    const a: Point2D = { x: points[i - 1].x, y: points[i - 1].y };
    const b: Point2D = { x: points[i].x, y: points[i].y };
    const foot = getNearestPointOnLine(cursor, a, b, false);
    if (calculateDistance(cursor, foot) <= maxDistance) {
      feet.push({ point: foot, segmentIndex: i - 1 });
    }
  }

  return feet;
}
