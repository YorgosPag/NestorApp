/**
 * ADR-363 Phase 5.5g — Opening outline snap projection helpers.
 *
 * Two pure functions for snapping to the 4-edge cutout outline of an
 * OpeningEntity (`geometry.outline.vertices`, Phase 2 invariant):
 *
 *   - `projectPointOnOpeningOutline` (clamped, NEAREST semantics):
 *     Closest clamped foot on any of the 4 outline edges. Used by
 *     NearestSnapEngine to snap to the nearest frame edge.
 *
 *   - `getOpeningOutlinePerpendicularFeet` (unclamped, PERPENDICULAR semantics):
 *     Foot of perpendicular on the infinite extension of each outline edge,
 *     filtered by maxDistance. Used by PerpendicularSnapEngine. Mirrors Phase
 *     5.5e (wall axis) and Phase 5.5f (slab edge) patterns.
 *
 * Cached geometry SSoT: `opening.geometry.outline.vertices` (4 Point3D, CCW,
 * Phase 2 invariant). Closing edge [3]→[0] included via modulo `(i+1) % 4`.
 *
 * Vertex layout (horizontal wall, y-up perpendicular):
 *   [0] start-outer  [1] end-outer  [2] end-inner  [3] start-inner
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.5g
 */

import type { Point2D } from '../../rendering/types/Types';
import type { OpeningEntity } from '../types/opening-types';
import { nearestFootOnPolyline, perpendicularFeetOverPolyline } from '../../snapping/shared/polyline-perpendicular-feet';

/**
 * NEAREST-semantics: clamped closest foot on the 4-edge opening outline.
 * Returns `null` if `opening.geometry.outline.vertices` is missing or has <4
 * entries. Mirrors `projectPointOnSlabEdge` (Phase 5.5f).
 */
export function projectPointOnOpeningOutline(
  opening: OpeningEntity,
  cursor: Point2D,
): Point2D | null {
  const verts = opening.geometry?.outline?.vertices;
  if (!verts || verts.length < 4) return null;
  // CLOSED 4-edge outline — closing edge [3→0] included by the shared helper.
  return nearestFootOnPolyline(verts, cursor, true);
}

/**
 * PERPENDICULAR-semantics: unclamped foot on the infinite extension of each
 * outline edge, filtered by `maxDistance`. `edgeIndex` = 0..n-1 CCW:
 *   0 = outer face, 1 = end jamb, 2 = inner face, 3 = start jamb.
 *
 * Mirrors `getSlabEdgePerpendicularFeet` (Phase 5.5f) — allows snap past
 * frame corner (AutoCAD PERPENDICULAR semantics για rectangles).
 */
export function getOpeningOutlinePerpendicularFeet(
  opening: OpeningEntity,
  cursor: Point2D,
  maxDistance: number,
): Array<{ point: Point2D; edgeIndex: number }> {
  const verts = opening.geometry?.outline?.vertices;
  if (!verts || verts.length < 4) return [];
  // CLOSED 4-edge outline; `edgeIndex` = the shared helper's 0-based `segmentIndex`.
  return perpendicularFeetOverPolyline(verts, cursor, maxDistance, true)
    .map((f) => ({ point: f.point, edgeIndex: f.segmentIndex }));
}
