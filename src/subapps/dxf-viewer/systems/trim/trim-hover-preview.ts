/**
 * TRIM HOVER PREVIEW — ADR-350 Phase 6
 *
 * Computes the geometric path of the sub-segment that WOULD be removed by
 * a TRIM pick at `pickPoint`, for rendering in the live red overlay before
 * the user confirms the click.
 *
 * Entity support:
 *   - LINE     → exact removed sub-segment [t0, t1] endpoints
 *   - ARC      → tessellated arc sweep of the removed portion (16 pts)
 *   - POLYLINE / LWPOLYLINE → the containing segment vertices
 *   - Others   → empty array (no hover preview rendered)
 *
 * Pure functions — no React, no state, no side effects.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §Phase 6
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  isArcEntity,
  isLineEntity,
  isLWPolylineEntity,
  isPolylineEntity,
  type ArcEntity,
  type Entity,
  type LineEntity,
} from '../../types/entities';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
import { buildSegments, dedupeSorted, findSegmentContaining, PARAM_EPSILON } from './trim-cut-shared';
import { paramOnLineSegment } from './trim-intersection-mapper';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a ≥2-point path representing the sub-segment that would be removed
 * by trimming `entity` at `pickPoint`, given its intersection set.
 *
 * Returns an empty array when the hover cannot be computed (entity type not
 * supported, no intersection, or degenerate geometry).
 */
export function computeHoverPreviewPath(
  entity: Entity,
  intersections: ReadonlyArray<Point2D>,
  pickPoint: Point2D,
): ReadonlyArray<Point2D> {
  if (isLineEntity(entity)) return hoverLine(entity, intersections, pickPoint);
  if (isArcEntity(entity)) return hoverArc(entity, intersections, pickPoint);
  if (isLWPolylineEntity(entity) || isPolylineEntity(entity)) {
    return hoverPolyline(entity.vertices as Point2D[], entity.closed === true, intersections, pickPoint);
  }
  return [];
}

// ── LINE ──────────────────────────────────────────────────────────────────────

function hoverLine(line: LineEntity, intersections: ReadonlyArray<Point2D>, pickPoint: Point2D): ReadonlyArray<Point2D> {
  const ts = toLineParams(line, intersections);
  const segs = buildSegments(0, 1, ts);
  const pickT = paramOnLineSegment(line.start, line.end, pickPoint) ?? 0;
  const idx = findSegmentContaining(segs, pickT);
  if (idx < 0) return [];
  const [t0, t1] = segs[idx];
  return [lerpLine(line, t0), lerpLine(line, t1)];
}

function toLineParams(line: LineEntity, pts: ReadonlyArray<Point2D>): number[] {
  const raw = pts
    .map((p) => paramOnLineSegment(line.start, line.end, p))
    .filter((t): t is number => t !== null && t > PARAM_EPSILON && t < 1 - PARAM_EPSILON);
  return dedupeSorted(raw);
}

function lerpLine(line: LineEntity, t: number): Point2D {
  return {
    x: line.start.x + t * (line.end.x - line.start.x),
    y: line.start.y + t * (line.end.y - line.start.y),
  };
}

// ── ARC ───────────────────────────────────────────────────────────────────────

const ARC_HOVER_SEGMENTS = 16;
const TWO_PI = Math.PI * 2;

function hoverArc(arc: ArcEntity, intersections: ReadonlyArray<Point2D>, pickPoint: Point2D): ReadonlyArray<Point2D> {
  const sweepLen = arcSweepLength(arc);
  if (Math.abs(sweepLen) < PARAM_EPSILON) return [];

  const ts = intersections
    .map((p) => arcSweepParam(arc, p, sweepLen))
    .filter((t) => t > PARAM_EPSILON && t < 1 - PARAM_EPSILON);
  const cuts = dedupeSorted(ts);
  const segs = buildSegments(0, 1, cuts);
  const pickT = arcSweepParam(arc, pickPoint, sweepLen);
  const idx = findSegmentContaining(segs, pickT);
  if (idx < 0) return [];
  return tessellateArcSweep(arc, segs[idx][0], segs[idx][1], sweepLen, ARC_HOVER_SEGMENTS);
}

function arcSweepLength(arc: ArcEntity): number {
  const ccw = arc.counterclockwise !== false;
  const s = normalizeAngle(arc.startAngle);
  const e = normalizeAngle(arc.endAngle);
  if (ccw) return e >= s ? e - s : TWO_PI - (s - e);
  return -(s >= e ? s - e : TWO_PI - (e - s));
}

function arcSweepParam(arc: ArcEntity, pt: Point2D, sweepLen: number): number {
  const theta = normalizeAngle(Math.atan2(pt.y - arc.center.y, pt.x - arc.center.x));
  const s = normalizeAngle(arc.startAngle);
  const ccw = sweepLen > 0;
  let offset: number;
  if (ccw) {
    offset = theta >= s ? theta - s : TWO_PI - (s - theta);
  } else {
    offset = theta <= s ? s - theta : TWO_PI - (theta - s);
  }
  return offset / Math.abs(sweepLen);
}

function tessellateArcSweep(arc: ArcEntity, t0: number, t1: number, sweepLen: number, n: number): Point2D[] {
  const s = normalizeAngle(arc.startAngle);
  const pts: Point2D[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const angle = s + t * sweepLen;
    pts.push({ x: arc.center.x + arc.radius * Math.cos(angle), y: arc.center.y + arc.radius * Math.sin(angle) });
  }
  return pts;
}

// ── POLYLINE ──────────────────────────────────────────────────────────────────

function hoverPolyline(
  vertices: ReadonlyArray<Point2D>,
  closed: boolean,
  intersections: ReadonlyArray<Point2D>,
  pickPoint: Point2D,
): ReadonlyArray<Point2D> {
  if (vertices.length < 2) return [];
  const segs = getPolylineSegments(vertices as Point2D[], closed);
  if (segs.length === 0) return [];
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < segs.length; i++) {
    const t = paramOnLineSegment(segs[i].start, segs[i].end, pickPoint);
    if (t === null) continue;
    const px = segs[i].start.x + t * (segs[i].end.x - segs[i].start.x);
    const py = segs[i].start.y + t * (segs[i].end.y - segs[i].start.y);
    const d = (px - pickPoint.x) ** 2 + (py - pickPoint.y) ** 2;
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  void intersections;  // future: narrow to sub-range between intersection params
  return [segs[bestIdx].start, segs[bestIdx].end];
}

// ── Shared ────────────────────────────────────────────────────────────────────

function normalizeAngle(a: number): number {
  const t = a % TWO_PI;
  return t < 0 ? t + TWO_PI : t;
}
