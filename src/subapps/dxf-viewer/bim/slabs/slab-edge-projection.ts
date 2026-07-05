/**
 * Slab Edge Projection — pure SSoT για ADR-363 Phase 5.5f.
 *
 * Snap-to-slab-edge perpendicular projection (Revit "Snap to Edge / Face").
 * Όταν cursor κουμπώνει κοντά σε slab outline edge (όχι σε slab vertex /
 * edge-midpoint που καλύπτουν ήδη EndpointSnapEngine + MidpointSnapEngine),
 * τα `NearestSnapEngine` + `PerpendicularSnapEngine` καταναλώνουν αυτό το
 * module ώστε οποιοδήποτε drawing tool με snap να προβάλλει τον cursor πάνω
 * στην ακμή της πλάκας.
 *
 * Δεν αναπαράγει polygon maths: διαβάζει `slab.geometry.polygon.points`
 * που είναι cached από `computeSlabGeometry()` (Phase 3 invariant). Η πλάκα
 * είναι CLOSED polygon (CCW) — η τελευταία ακμή [last→first] συμπεριλαμβάνεται.
 *
 * Mirror του `wall-axis-projection.ts` (Phase 5.5e) — ίδιο API, ίδια σημασιολογία:
 *   - `projectPointOnSlabEdge` → clamped (NEAREST semantics)
 *   - `getSlabEdgePerpendicularFeet` → unclamped per-edge, filtered by radius (PERPENDICULAR semantics)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.5f
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity } from '../types/slab-types';
import { nearestFootOnPolyline, perpendicularFeetOverPolyline } from '../../snapping/shared/polyline-perpendicular-feet';

/**
 * Κλειστά clamped foot — closest point πάνω σε οποιαδήποτε ακμή του slab
 * outline polygon. Σημασιολογία **NEAREST**: foot clamped στο εκάστοτε
 * edge segment, συμπεριλαμβάνοντας την closing edge [last→first].
 *
 * Επιστρέφει `null` εάν το slab δεν έχει cached geometry ή λιγότερους από
 * 3 vertices (defensive — Phase 3 invariant guarantees ≥3).
 */
export function projectPointOnSlabEdge(
  slab: SlabEntity,
  cursor: Point2D,
): Point2D | null {
  const points = slab.geometry?.polygon?.vertices;
  if (!points || points.length < 3) return null;
  // CLOSED polygon — the closing edge [last→first] is included by the shared helper.
  return nearestFootOnPolyline(points, cursor, true);
}

/**
 * Unclamped feet — ένα foot ανά edge, υπολογισμένο στην infinite line
 * extension του εκάστοτε edge. Σημασιολογία **PERPENDICULAR** (AutoCAD/
 * Revit): καλύπτει την περίπτωση όπου ο user θέλει ορθογώνια προβολή στην
 * προέκταση ακμής πλάκας (cursor πέρα από edge vertex).
 *
 * Filtered by `maxDistance`. Returns κενό array εάν geometry missing ή
 * κανένα foot εντός radius. Closing edge [last→first] συμπεριλαμβάνεται.
 */
export function getSlabEdgePerpendicularFeet(
  slab: SlabEntity,
  cursor: Point2D,
  maxDistance: number,
): Array<{ point: Point2D; edgeIndex: number }> {
  const points = slab.geometry?.polygon?.vertices;
  if (!points || points.length < 3) return [];
  // CLOSED polygon; `edgeIndex` = the shared helper's 0-based `segmentIndex`.
  return perpendicularFeetOverPolyline(points, cursor, maxDistance, true)
    .map((f) => ({ point: f.point, edgeIndex: f.segmentIndex }));
}
