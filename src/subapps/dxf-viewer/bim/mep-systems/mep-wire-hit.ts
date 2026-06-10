/**
 * mep-wire-hit — pure point-vs-circuit-wire hit-test (Revit "click a wire to select it").
 *
 * The home-run wires are NOT scene entities — they are the derived rendering of the electrical
 * circuits (`MepSystem`). To make a wire click-selectable we test the click point against the
 * SAME polyline the overlay draws (`buildWirePolyline`, which expands each segment by the
 * circuit's wiring style), across every circuit, and return the nearest circuit within tolerance.
 *
 * The owning circuit is the SSoT selection target — the caller sets it as the active circuit
 * (which lights the wire's grips + opens the «Κύκλωμα» contextual tab), Revit "Modify | Wires".
 *
 * @see ./mep-wire-routing.ts — `computeCircuitWirePaths` (build paths) + `buildWirePolyline`
 * @see ../../hooks/canvas/use-mep-wire-waypoint-interaction.ts — the click consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { segmentsIntersect } from '../../utils/geometry/GeometryUtils';
import { buildWirePolyline, type CircuitWirePath } from './mep-wire-routing';

/** Axis-aligned world-space rectangle (marquee selection box). */
export interface WorldBounds {
  readonly min: Point2D;
  readonly max: Point2D;
}

/**
 * Return the `systemId` of the circuit whose home-run wire passes closest to `world` (within
 * `tolWorld` world units), or `null` when no wire is within tolerance. Ties resolve to the
 * last-tested path (top-most in draw order), matching the paint sequence.
 */
export function hitTestCircuitWirePaths(
  world: Point2D,
  paths: readonly CircuitWirePath[],
  tolWorld: number,
): string | null {
  let bestId: string | null = null;
  let bestDist = tolWorld;
  for (const path of paths) {
    const pts = buildWirePolyline(path);
    for (let i = 1; i < pts.length; i++) {
      const d = pointToLineDistance(world, pts[i - 1]!, pts[i]!);
      if (d <= bestDist) {
        bestDist = d;
        bestId = path.systemId;
      }
    }
  }
  return bestId;
}

/** True when `p` lies inside (or on the edge of) the axis-aligned `bounds`. */
function pointInBounds(p: Point2D, b: WorldBounds): boolean {
  return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}

/** True when segment `a→b` crosses any of the four edges of `bounds`. */
function segmentCrossesBounds(a: Point2D, b: Point2D, bounds: WorldBounds): boolean {
  const c1 = { x: bounds.min.x, y: bounds.min.y };
  const c2 = { x: bounds.max.x, y: bounds.min.y };
  const c3 = { x: bounds.max.x, y: bounds.max.y };
  const c4 = { x: bounds.min.x, y: bounds.max.y };
  return (
    segmentsIntersect(a, b, c1, c2) ||
    segmentsIntersect(a, b, c2, c3) ||
    segmentsIntersect(a, b, c3, c4) ||
    segmentsIntersect(a, b, c4, c1)
  );
}

/**
 * Return the `systemId`s of every circuit whose home-run wire is caught by a marquee box,
 * using AutoCAD/Revit window-vs-crossing semantics (the SAME polyline the overlay draws):
 *
 * - **window** (`isCrossing=false`, left→right drag): the wire must be *fully enclosed* —
 *   every polyline vertex inside the box.
 * - **crossing** (`isCrossing=true`, right→left drag): the wire need only *touch* the box —
 *   any vertex inside, or any segment crossing a box edge.
 *
 * Order follows the paint sequence (top-most last), so callers that want a single circuit can
 * take the last entry to match the click-select tie-break.
 */
export function selectCircuitsInMarquee(
  bounds: WorldBounds,
  isCrossing: boolean,
  paths: readonly CircuitWirePath[],
): string[] {
  const hits: string[] = [];
  for (const path of paths) {
    const pts = buildWirePolyline(path);
    if (pts.length === 0) continue;
    let selected: boolean;
    if (isCrossing) {
      selected = pts.some((p) => pointInBounds(p, bounds));
      for (let i = 1; !selected && i < pts.length; i++) {
        selected = segmentCrossesBounds(pts[i - 1]!, pts[i]!, bounds);
      }
    } else {
      selected = pts.every((p) => pointInBounds(p, bounds));
    }
    if (selected) hits.push(path.systemId);
  }
  return hits;
}
