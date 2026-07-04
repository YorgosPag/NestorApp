/**
 * OFFSET — bulge-aware polyline offset (ADR-510 Φ4d).
 *
 * The straight-only case is handled upstream by the proven
 * `rendering/entities/shared/geometry-offset-utils.ts::offsetPolyline` (miter/bevel
 * joins). This module covers the ONE case that has no existing helper: a polyline
 * whose segments mix straight lines and arcs (DXF `bulges`).
 *
 * Key geometric fact (per the SSoT audit): a concentric offset of an arc leaves the
 * `bulge` scalar INVARIANT (the swept angle θ is unchanged, and bulge = tan(θ/4));
 * only the two endpoints move radially to `radius ± d`. So we offset each segment's
 * endpoints, copy every bulge through unchanged, and reconcile the shared vertices:
 *   • straight ∩ straight → miter (intersection of the two offset lines)
 *   • any corner touching an arc → midpoint of the two radial/perp offset endpoints
 *     (they nearly coincide for tangent «rounded» corners; a small nudge stays a
 *     valid arc because `bulge` reconstructs a smooth arc through the new endpoints).
 *
 * Reuses only existing SSoT primitives (`bulgeToArc`, `getPerpendicularUnitVector`,
 * `offsetPoint`, `pointOnCircle`) — zero duplicated math.
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  getPerpendicularUnitVector,
  offsetPoint,
  pointOnCircle,
  calculateMidpoint,
  infiniteLineIntersection,
} from '../../rendering/entities/shared/geometry-vector-utils';
import { bulgeToArc, isStraightSegment } from '../../rendering/entities/shared/geometry-bulge-utils';
import { OFFSET_MIN_DIMENSION } from './offset-types';

interface OffsetSegment {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly straight: boolean;
}

/** Offset a straight segment `p0→p1` by signed distance `d` (left = positive). */
function offsetStraightSegment(p0: Point2D, p1: Point2D, d: number): OffsetSegment | null {
  const perp = getPerpendicularUnitVector(p0, p1);
  if (perp.x === 0 && perp.y === 0) return null;
  return { start: offsetPoint(p0, perp, d), end: offsetPoint(p1, perp, d), straight: true };
}

/**
 * Offset an arc segment concentrically. Left (+d) moves toward the arc centre for a
 * CCW arc (bulge > 0) and away for CW, i.e. `r' = r - sign(bulge)·d`. The bulge is
 * kept as-is by the caller. Returns null if the arc collapses (`r' ≤ 0`).
 */
function offsetArcSegment(p0: Point2D, p1: Point2D, bulge: number, d: number): OffsetSegment | null {
  const arc = bulgeToArc(p0, p1, bulge);
  if (!arc) return null;
  const newRadius = arc.radius - Math.sign(bulge) * d;
  if (newRadius <= OFFSET_MIN_DIMENSION) return null;
  return {
    start: pointOnCircle(arc.center, newRadius, arc.startAngle),
    end: pointOnCircle(arc.center, newRadius, arc.endAngle),
    straight: false,
  };
}

/** Reconcile the shared vertex between offset segment `prev` and `next`. */
function joinVertex(prev: OffsetSegment, next: OffsetSegment): Point2D {
  if (prev.straight && next.straight) {
    const miter = infiniteLineIntersection(prev.start, prev.end, next.start, next.end);
    if (miter) return miter;
  }
  return calculateMidpoint(prev.end, next.start);
}

/**
 * Offset a polyline that contains at least one arc segment.
 * @returns new `{ vertices, bulges }` or null if any arc collapses / degenerate.
 */
export function offsetPolylineWithBulges(
  vertices: readonly Point2D[],
  bulges: readonly number[] | undefined,
  closed: boolean,
  signedDistance: number,
): { vertices: Point2D[]; bulges: number[] } | null {
  const n = vertices.length;
  if (n < 2) return null;
  const segCount = closed ? n : n - 1;

  // 1) Offset every segment's endpoints; copy each bulge through unchanged.
  const segs: OffsetSegment[] = new Array(segCount);
  const outBulges: number[] = new Array(segCount).fill(0);
  for (let i = 0; i < segCount; i++) {
    const p0 = vertices[i];
    const p1 = vertices[(i + 1) % n];
    const bulge = bulges?.[i] ?? 0;
    const seg = isStraightSegment(bulge)
      ? offsetStraightSegment(p0, p1, signedDistance)
      : offsetArcSegment(p0, p1, bulge, signedDistance);
    if (!seg) return null;
    segs[i] = seg;
    outBulges[i] = seg.straight ? 0 : bulge;
  }

  // 2) Reconcile shared vertices into the final vertex list.
  const outVerts: Point2D[] = new Array(n);
  if (closed) {
    for (let k = 0; k < n; k++) {
      const prev = segs[(k - 1 + segCount) % segCount];
      outVerts[k] = joinVertex(prev, segs[k]);
    }
  } else {
    outVerts[0] = segs[0].start;
    for (let k = 1; k < n - 1; k++) outVerts[k] = joinVertex(segs[k - 1], segs[k]);
    outVerts[n - 1] = segs[segCount - 1].end;
  }

  return { vertices: outVerts, bulges: outBulges };
}
