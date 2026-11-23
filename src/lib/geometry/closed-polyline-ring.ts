/**
 * CLOSED POLYLINE → RING (SSoT) — «does this polyline enclose an area, and what is its outline?» (ADR-920 Β6.11 Ζ1).
 *
 * Two consumers ask the same question: the DXF Viewer's volume-boundary pick (ADR-650 M6 · `topo-boundary-pick.ts`)
 * and the owner's plot-outline import (ADR-920 §14.11). The predicate lives here, once, so «what may be picked as a
 * boundary» cannot drift between them (`src/lib` may not import from the subapp, CHECK 3.62).
 *
 * 🔑 **Only a CLOSED polyline has an inside.** An open one is refused, never auto-closed: closing it would invent an
 *    edge the surveyor never drew, and silently change an area.
 * 🔑 **Arcs are geometry, not decoration.** A plot boundary along a curved road is an arc (bulge, DXF 42). Reading
 *    only the vertices would cut the chord and lose the segment's area — {@link closedRingWithArcs} tessellates every
 *    bulge through the ONE bulge SSoT (`polyline-bulge`).
 *
 * @module lib/geometry/closed-polyline-ring
 */

import type { PlanarPoint } from './planar-polygon';
import { expandPolyline } from './polyline-bulge';

/** A ring needs at least a triangle's worth of vertices. */
export const MIN_RING_VERTICES = 3;

/**
 * Angular step for tessellating an arc of a boundary, degrees. 3° keeps the chord error below 0.035 % of the radius
 * (r·(1 − cos 1.5°)) — 1.4 cm on a 40 m road curve — while a semicircle stays at 60 points.
 */
export const RING_ARC_STEP_DEG = 3;

/**
 * **The predicate**: a polyline qualifies as a ring when it is flagged CLOSED and has ≥ {@link MIN_RING_VERTICES}
 * vertices. Topological, so it holds in any frame (DISPLAY or WORLD) — no projector needed.
 */
export function qualifiesAsClosedRing(closed: boolean | undefined, vertexCount: number): boolean {
  return closed === true && vertexCount >= MIN_RING_VERTICES;
}

/** Two coordinates equal up to float noise relative to their magnitude (ΕΓΣΑ mm reach 10⁹). */
function sameCoordinate(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** `true` when two points coincide up to float noise. */
export function samePlanarPoint(a: PlanarPoint, b: PlanarPoint): boolean {
  return sameCoordinate(a.x, b.x) && sameCoordinate(a.y, b.y);
}

/** Drops consecutive duplicates and a closing repeat of the first point — a ring never lists a vertex twice in a row. */
export function withoutRepeatedPoints(points: readonly PlanarPoint[]): PlanarPoint[] {
  const out: PlanarPoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last === undefined || !samePlanarPoint(last, p)) out.push({ x: p.x, y: p.y });
  }
  while (out.length > 1 && samePlanarPoint(out[0], out[out.length - 1])) out.pop();
  return out;
}

/**
 * The ring of a CLOSED polyline, every arc tessellated, without a repeated closing point — or `null` when fewer
 * than {@link MIN_RING_VERTICES} distinct points remain. The caller has already decided the polyline is closed.
 *
 * @param bulges index-aligned with `vertices`; `bulges[i]` is the arc of `vertices[i] → vertices[i + 1]` and the last
 *   one closes the ring (last → first).
 */
export function closedRingWithArcs(
  vertices: readonly PlanarPoint[],
  bulges: readonly number[] | undefined,
  maxSegDeg: number = RING_ARC_STEP_DEG,
): PlanarPoint[] | null {
  if (vertices.length < MIN_RING_VERTICES) return null;
  const ring = withoutRepeatedPoints(expandPolyline(vertices, bulges, true, maxSegDeg));
  return ring.length >= MIN_RING_VERTICES ? ring : null;
}
