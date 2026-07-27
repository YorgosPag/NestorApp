/**
 * polyline-perpendicular-feet — pure SSoT for projecting a cursor onto the segments/edges of a
 * polyline or closed polygon (ADR-363 Phase 5.5e/5.5f/5.5g).
 *
 * Extracted from the three byte-identical per-entity copies (wall axis / slab edge / opening outline,
 * `bim/walls/wall-axis-projection.ts`, `bim/slabs/slab-edge-projection.ts`,
 * `bim/walls/opening-outline-projection.ts`) which each re-implemented the same
 * loop-over-segments + `%n` wraparound + nearest/filter logic. The ONLY thing that differed was the
 * vertex SOURCE and whether the shape is closed — now a `closed` flag — so the iteration lives once.
 *
 * Two semantics, mirroring AutoCAD/Revit:
 *   - `nearestFootOnPolyline` (clamped) — NEAREST: closest clamped foot on any segment, single point.
 *   - `perpendicularFeetOverPolyline` (unclamped) — PERPENDICULAR: one foot on each segment's infinite
 *     extension, filtered by `maxDistance`; `segmentIndex` = 0-based segment (open: 0..n-2, closed: 0..n-1
 *     incl. the closing edge [last→first]).
 *
 * The per-segment math delegates to the `getNearestPointOnLine` SSoT — zero new projection math here.
 * Callers keep their entity-specific guards (min vertex count) and vertex extraction.
 *
 * ADR-662 — the same two semantics over a SET of closed rings (`…OnClosedRings` /
 * `…OverClosedRings`): a hatch boundary or a topo-surface footprint is several closed rings, not one
 * polygon. Both fan out over the single-ring functions above, so the segment iteration still lives once.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.5e/5.5f/5.5g
 * @see ./entity-closed-rings.ts — which entity field holds those rings
 */

import type { Point2D } from '../../rendering/types/Types';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';

/** A 2D-readable vertex — accepts Point2D or Point3D (only x/y are read). */
type XY = Readonly<{ x: number; y: number }>;

/** Number of segments to iterate: closed polygon = n (incl. closing edge), open polyline = n − 1. */
function segmentCount(n: number, closed: boolean): number {
  return closed ? n : n - 1;
}

/**
 * Walks the segments and hands each foot to `visit`. ONE owner of «which segments exist, and where
 * does the cursor land on each» — the two public semantics below differ ONLY in clamping and in what
 * they keep, never in the walk itself. Extracted after CHECK 3.28 flagged the two loops as a
 * 99-token clone: the closing-edge modulo is exactly the kind of detail that drifts between twins.
 *
 * Callback (not a generator) and two positional args (not an object) — this runs per mousemove per
 * candidate entity, so the walk stays allocation-neutral versus the code it replaced.
 */
function forEachSegmentFoot(
  points: ReadonlyArray<XY>,
  cursor: Point2D,
  closed: boolean,
  clamp: boolean,
  visit: (foot: Point2D, segmentIndex: number) => void,
): void {
  const n = points.length;
  const segs = segmentCount(n, closed);

  for (let s = 0; s < segs; s++) {
    const a: Point2D = { x: points[s].x, y: points[s].y };
    const b: Point2D = { x: points[(s + 1) % n].x, y: points[(s + 1) % n].y };
    visit(getNearestPointOnLine(cursor, a, b, clamp), s);
  }
}

/**
 * NEAREST (clamped): closest foot on any segment of the polyline/polygon, or `null` when fewer than
 * 2 vertices. The foot is clamped to each segment, so a cursor past an endpoint snaps to that endpoint
 * (not the infinite extension).
 */
export function nearestFootOnPolyline(
  points: ReadonlyArray<XY>,
  cursor: Point2D,
  closed: boolean,
): Point2D | null {
  const n = points.length;
  if (n < 2) return null;

  let closest: Point2D | null = null;
  let closestDistance = Infinity;

  forEachSegmentFoot(points, cursor, closed, true, (foot) => {
    const d = calculateDistance(cursor, foot);
    if (d < closestDistance) {
      closestDistance = d;
      closest = foot;
    }
  });

  return closest;
}

/**
 * PERPENDICULAR (unclamped): one foot per segment on its INFINITE extension, filtered by `maxDistance`.
 * Returns an empty array when fewer than 2 vertices or no foot is within radius. `segmentIndex` is the
 * 0-based segment index (open: 0..n-2, closed: 0..n-1 including the closing edge).
 */
export function perpendicularFeetOverPolyline(
  points: ReadonlyArray<XY>,
  cursor: Point2D,
  maxDistance: number,
  closed: boolean,
): Array<{ point: Point2D; segmentIndex: number }> {
  const n = points.length;
  if (n < 2) return [];

  const feet: Array<{ point: Point2D; segmentIndex: number }> = [];

  forEachSegmentFoot(points, cursor, closed, false, (foot, segmentIndex) => {
    if (calculateDistance(cursor, foot) <= maxDistance) {
      feet.push({ point: foot, segmentIndex });
    }
  });

  return feet;
}

/**
 * ADR-662 — NEAREST (clamped) over a SET of closed rings: the single closest foot across every ring,
 * or `null` when no ring has 2+ vertices. Each ring is treated as CLOSED, so the closing edge
 * [last→first] competes like any other. Rings are independent solid boundaries (topo TIN perimeter +
 * islands, hatch outer + islands) — proximity, not containment, decides the winner.
 */
export function nearestFootOnClosedRings(
  rings: ReadonlyArray<ReadonlyArray<XY>>,
  cursor: Point2D,
): Point2D | null {
  let winner: Point2D | null = null;
  let winnerDistance = Infinity;

  for (const ring of rings) {
    const foot = nearestFootOnPolyline(ring, cursor, true);
    if (!foot) continue;
    const d = calculateDistance(cursor, foot);
    if (d < winnerDistance) {
      winnerDistance = d;
      winner = foot;
    }
  }

  return winner;
}

/**
 * ADR-662 — PERPENDICULAR (unclamped) over a SET of closed rings: every ring contributes one foot per
 * edge on that edge's infinite extension, filtered by `maxDistance`. `ringIndex` + `segmentIndex`
 * identify the edge (both 0-based; `segmentIndex` includes the closing edge of its ring).
 */
export function perpendicularFeetOverClosedRings(
  rings: ReadonlyArray<ReadonlyArray<XY>>,
  cursor: Point2D,
  maxDistance: number,
): Array<{ point: Point2D; ringIndex: number; segmentIndex: number }> {
  return rings.flatMap((ring, ringIndex) =>
    perpendicularFeetOverPolyline(ring, cursor, maxDistance, true)
      .map((f) => ({ point: f.point, ringIndex, segmentIndex: f.segmentIndex })),
  );
}
