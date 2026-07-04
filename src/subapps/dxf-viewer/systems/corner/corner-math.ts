/**
 * CORNER MATH — shared SSoT for the FILLET & CHAMFER corner tools (ADR-510 Φ4e/Φ4f).
 *
 * Both AutoCAD FILLET and CHAMFER share the same "pick two lines → connect their
 * corner + trim the far ends" harness. The only difference is the CONNECTOR (a
 * tangent arc for fillet, a bevel line for chamfer). This module owns everything
 * that is common: the corner vertex, which endpoint each pick keeps, the direction
 * from the vertex toward that anchor, the angle between the two rays, and the trim
 * of a line to a new corner point.
 *
 * Reuses only existing geometry SSoT — zero duplicated math:
 *   • `infiniteLineIntersection` (geometry-vector-utils, extracted from OFFSET)
 *   • `getUnitVector` / `calculateDistance` / `angleBetweenVectors`
 *   • `subtractPoints` / `dotProduct`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4e
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LineEntity, LWPolylineEntity, PolylineEntity } from '../../types/entities';
import {
  infiniteLineIntersection,
  getUnitVector,
  calculateDistance,
  angleBetweenVectors,
  subtractPoints,
  dotProduct,
} from '../../rendering/entities/shared/geometry-vector-utils';
import { nearestPolylineSegment } from '../../rendering/entities/shared/geometry-rendering-utils';

/** Below this a corner is degenerate (parallel/collinear lines, zero-length ray). */
export const CORNER_EPSILON = 1e-9;

/** The resolved geometry of the corner formed by two picked lines. */
export interface CornerAnchors {
  /** Intersection of the two INFINITE lines (the sharp corner). */
  readonly vertex: Point2D;
  /** Endpoint of line 1 that the pick KEEPS (the far anchor). */
  readonly keep1: Point2D;
  readonly keep2: Point2D;
  /** true when `keep1` is `line1.start` — the OTHER endpoint is the one trimmed. */
  readonly keep1IsStart: boolean;
  readonly keep2IsStart: boolean;
  /** Unit direction from `vertex` toward `keep1` / `keep2`. */
  readonly dir1: Point2D;
  readonly dir2: Point2D;
  /** Interior angle between `dir1` and `dir2`, in (0, π). */
  readonly angle: number;
  /** Distance from `vertex` to `keep1` / `keep2` = available trim room along each line. */
  readonly len1: number;
  readonly len2: number;
}

/**
 * Pick the endpoint of `line` to KEEP: the one on the same side of `vertex` as the
 * user's pick point. Projects both endpoints onto the pick direction and keeps the
 * more-aligned one (AutoCAD "the side you click on stays"). Robust when the vertex
 * is interior to the segment (endpoints on opposite sides) or beyond it (extend case).
 */
function pickKeepEndpoint(
  line: LineEntity,
  vertex: Point2D,
  pick: Point2D,
): { point: Point2D; isStart: boolean } {
  const toPick = subtractPoints(pick, vertex);
  const sStart = dotProduct(subtractPoints(line.start, vertex), toPick);
  const sEnd = dotProduct(subtractPoints(line.end, vertex), toPick);
  return sStart >= sEnd
    ? { point: line.start, isStart: true }
    : { point: line.end, isStart: false };
}

/**
 * Resolve the shared corner geometry for a FILLET/CHAMFER between `line1` and
 * `line2`, disambiguated by the two pick points. Returns null when the lines are
 * parallel/collinear or a ray is degenerate.
 */
export function resolveCornerAnchors(
  line1: LineEntity,
  pick1: Point2D,
  line2: LineEntity,
  pick2: Point2D,
): CornerAnchors | null {
  const vertex = infiniteLineIntersection(line1.start, line1.end, line2.start, line2.end);
  if (!vertex) return null;

  const a1 = pickKeepEndpoint(line1, vertex, pick1);
  const a2 = pickKeepEndpoint(line2, vertex, pick2);
  const dir1 = getUnitVector(vertex, a1.point);
  const dir2 = getUnitVector(vertex, a2.point);
  if ((dir1.x === 0 && dir1.y === 0) || (dir2.x === 0 && dir2.y === 0)) return null;

  const angle = Math.abs(angleBetweenVectors(dir1, dir2));
  // Collinear (0 or π) → no distinct corner.
  if (angle < CORNER_EPSILON || Math.PI - angle < CORNER_EPSILON) return null;

  return {
    vertex,
    keep1: a1.point,
    keep2: a2.point,
    keep1IsStart: a1.isStart,
    keep2IsStart: a2.isStart,
    dir1,
    dir2,
    angle,
    len1: calculateDistance(vertex, a1.point),
    len2: calculateDistance(vertex, a2.point),
  };
}

/**
 * Trim `line` so that its non-anchor endpoint moves to `corner` (the tangent point
 * for fillet, the bevel endpoint for chamfer, or the vertex for R=0 extend). The
 * kept endpoint (`keepIsStart ? start : end`) stays fixed.
 */
export function trimLineToCorner(
  line: LineEntity,
  keepIsStart: boolean,
  corner: Point2D,
): LineEntity {
  return keepIsStart ? { ...line, end: corner } : { ...line, start: corner };
}

/** One line trimmed to a corner point (before/after for the undoable CornerEntityCommand). */
export interface CornerLineTrim {
  readonly entityId: string;
  readonly originalGeom: LineEntity;
  readonly newGeom: LineEntity;
}

/** Build the before/after trim of `line` at `corner`. Shared by FILLET and CHAMFER. */
export function makeLineTrim(line: LineEntity, keepIsStart: boolean, corner: Point2D): CornerLineTrim {
  return { entityId: line.id, originalGeom: line, newGeom: trimLineToCorner(line, keepIsStart, corner) };
}

/**
 * Resolve the shared corner (vertex index) between the two polyline segments picked at `p1`/`p2` —
 * the AutoCAD "pick two segments of the same polyline" flow for BOTH fillet (Φ4e.2) and chamfer
 * (Φ4f.2). Returns null when the picks hit the same segment or two non-adjacent segments (v1 limit —
 * AutoCAD also handles "one segment apart", left for a follow-up). Reuses the `nearestPolylineSegment`
 * SSoT. `cornerIndex` = the vertex between the two adjacent segments (with closed-polyline wrap).
 */
export function resolveSharedPolylineCorner(
  entity: PolylineEntity | LWPolylineEntity,
  p1: Point2D,
  p2: Point2D,
): number | null {
  const vertices = entity.vertices;
  if (!vertices || vertices.length < 3) return null;
  const closed = entity.closed === true;
  const s1 = nearestPolylineSegment(vertices, closed, p1);
  const s2 = nearestPolylineSegment(vertices, closed, p2);
  if (!s1 || !s2 || s1.segmentIndex === s2.segmentIndex) return null;

  const n = vertices.length;
  const segCount = closed ? n : n - 1;
  const lo = Math.min(s1.segmentIndex, s2.segmentIndex);
  const hi = Math.max(s1.segmentIndex, s2.segmentIndex);
  if (hi === lo + 1) return hi; // adjacent → shared vertex = vertices[lo+1]
  if (closed && lo === 0 && hi === segCount - 1) return 0; // closing↔first wrap → vertex 0
  return null;
}

/**
 * Trim `line` so its non-pick endpoint moves to `corner`, keeping the endpoint on the same
 * side of `corner` as the user's `pick` (the FILLET curve solver has no shared vertex — the
 * tangent point IS the corner). Reuses the `pickKeepEndpoint` side-resolution SSoT.
 */
export function trimLineAtPoint(line: LineEntity, corner: Point2D, pick: Point2D): CornerLineTrim {
  const keep = pickKeepEndpoint(line, corner, pick);
  return makeLineTrim(line, keep.isStart, corner);
}

// ── Shared polyline-corner scaffold (fillet «round» + chamfer «bevel») ──────────

/** Outgoing bulge of segment `i` (vertices[i]→[i+1]); 0/absent = straight. */
export function segBulge(bulges: readonly number[] | undefined, i: number): number {
  return bulges?.[i] ?? 0;
}

/** Corner indices carrying a real corner: all for closed, interior only for open. */
export function cornerIndices(n: number, closed: boolean): number[] {
  if (closed) return Array.from({ length: n }, (_, i) => i);
  return Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 1);
}

/** A polyline-corner candidate must expose how much length it consumes on each side. */
export interface CornerConsumption {
  /** Length consumed on the incoming segment (vertex j-1 → j). */
  readonly distPrev: number;
  /** Length consumed on the outgoing segment (vertex j → j+1). */
  readonly distNext: number;
}

/**
 * Drop candidates that do not fit: a corner whose consumption exceeds an adjacent
 * segment, AND (for a segment shared by two corners) whose two consumptions together
 * exceed the segment. Conservative — never overlaps. Shared by FILLET and CHAMFER.
 */
export function pruneCornerCandidates<T extends CornerConsumption>(
  candidates: Map<number, T>,
  n: number,
  closed: boolean,
  vertices: readonly Point2D[],
): void {
  for (const [j, c] of candidates) {
    const prevSeg = calculateDistance(vertices[(j - 1 + n) % n], vertices[j]);
    const nextSeg = calculateDistance(vertices[j], vertices[(j + 1) % n]);
    if (c.distPrev > prevSeg + CORNER_EPSILON || c.distNext > nextSeg + CORNER_EPSILON) {
      candidates.delete(j);
    }
  }
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const a = candidates.get(i); // consumes distNext on segment i
    const b = candidates.get((i + 1) % n); // consumes distPrev on segment i
    if (!a || !b) continue;
    const segLen = calculateDistance(vertices[i], vertices[(i + 1) % n]);
    if (a.distNext + b.distPrev > segLen + CORNER_EPSILON) {
      candidates.delete(i);
      candidates.delete((i + 1) % n);
    }
  }
}
