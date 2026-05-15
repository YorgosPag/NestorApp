/**
 * TRIM INTERSECTION MAPPER — ADR-350
 *
 * SSoT for converting (entity, intersection-point) → parameter value on the
 * entity's natural parametrisation, and for computing pairwise intersections
 * with the cutting-edge set during a trim pick.
 *
 * Design — reuses the snap engine's SSoT math wherever possible:
 *   - LINE/LINE, LINE/CIRCLE, CIRCLE/CIRCLE → `GeometricCalculations`
 *   - POLYLINE iteration → `getPolylineSegments`
 *   - ARC → filtered CIRCLE intersection clipped to angular sweep
 *   - ELLIPSE / SPLINE → tessellated to polyline (industry approximation,
 *     matches AutoCAD/BricsCAD internal trim algorithm)
 *   - RAY / XLINE → LINE with relaxed t bounds
 *
 * Pure functions only — no state, no side effects.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §Core Mathematics
 */

import type { Point2D } from '../../rendering/types/Types';
import { GeometricCalculations } from '../../snapping/shared/GeometricCalculations';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
import {
  isArcEntity,
  isCircleEntity,
  isEllipseEntity,
  isLineEntity,
  isLWPolylineEntity,
  isPolylineEntity,
  isRayEntity,
  isSplineEntity,
  isXLineEntity,
  type ArcEntity,
  type CircleEntity,
  type EllipseEntity,
  type Entity,
  type LineEntity,
  type LWPolylineEntity,
  type PolylineEntity,
  type RayEntity,
  type SplineEntity,
  type XLineEntity,
} from '../../types/entities';
import type { CuttingEdge } from './trim-types';

const TESSELLATION_SEGMENTS = 64;
const PARAM_EPSILON = 1e-9;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Composite parameter for polyline-style entities — index of the sub-segment
 * plus a local `t ∈ [0,1]` along that segment.
 */
export interface PolylineParam {
  readonly segmentIndex: number;
  readonly t: number;
}

/**
 * Returns the scalar parameter for a point on the entity's parameter space:
 *   - LINE: t ∈ [0, 1] (clamped to nearest)
 *   - ARC / CIRCLE / ELLIPSE: angle in radians, normalised to [0, 2π)
 *   - RAY: t ∈ [0, +∞)
 *   - XLINE: t ∈ ℝ
 *   - SPLINE / POLYLINE: use {@link paramOnPolyline} variant
 */
export function paramOnEntity(entity: Entity, point: Point2D): number | null {
  if (isLineEntity(entity)) return paramOnLineSegment(entity.start, entity.end, point);
  if (isRayEntity(entity)) return paramOnRay(entity, point);
  if (isXLineEntity(entity)) return paramOnXLine(entity, point);
  if (isArcEntity(entity)) return paramOnArc(entity, point);
  if (isCircleEntity(entity)) return paramOnCircle(entity, point);
  if (isEllipseEntity(entity)) return paramOnEllipseApprox(entity, point);
  return null;
}

export function paramOnPolyline(
  entity: PolylineEntity | LWPolylineEntity,
  point: Point2D,
): PolylineParam | null {
  const segments = getPolylineSegments(entity.vertices, entity.closed === true);
  let best: { idx: number; t: number; d2: number } | null = null;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const t = paramOnLineSegment(seg.start, seg.end, point);
    if (t === null) continue;
    const px = seg.start.x + t * (seg.end.x - seg.start.x);
    const py = seg.start.y + t * (seg.end.y - seg.start.y);
    const d2 = (px - point.x) ** 2 + (py - point.y) ** 2;
    if (!best || d2 < best.d2) best = { idx: i, t, d2 };
  }
  return best ? { segmentIndex: best.idx, t: best.t } : null;
}

export function paramOnSpline(entity: SplineEntity, point: Point2D): PolylineParam | null {
  const poly = tessellateSpline(entity);
  if (poly.length < 2) return null;
  const fakePoly: PolylineEntity = {
    id: entity.id,
    type: 'polyline',
    vertices: poly,
    closed: entity.closed === true,
  };
  return paramOnPolyline(fakePoly, point);
}

/**
 * Pairwise intersections between a target entity and a set of cutting edges.
 * Returned points are deduplicated within {@link PARAM_EPSILON}.
 *
 * Reuses snap-engine math; falls back to polyline tessellation for splines
 * and ellipses (AutoCAD/BricsCAD parity).
 */
export function computeIntersectionPoints(
  target: Entity,
  edges: ReadonlyArray<CuttingEdge>,
): Point2D[] {
  const out: Point2D[] = [];
  for (const edge of edges) {
    if (edge.sourceEntityId === target.id) continue;
    const pts = intersectEntities(target, edge.entity);
    for (const p of pts) if (!hasDuplicate(out, p)) out.push(p);
  }
  return out;
}

// ── Parameter helpers ────────────────────────────────────────────────────────

export function paramOnLineSegment(a: Point2D, b: Point2D, p: Point2D): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < PARAM_EPSILON) return null;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return t;
}

function paramOnRay(ray: RayEntity, p: Point2D): number | null {
  const dirLen = Math.hypot(ray.direction.x, ray.direction.y);
  if (dirLen < PARAM_EPSILON) return null;
  const ux = ray.direction.x / dirLen;
  const uy = ray.direction.y / dirLen;
  const t = (p.x - ray.basePoint.x) * ux + (p.y - ray.basePoint.y) * uy;
  return Math.max(0, t);
}

function paramOnXLine(xl: XLineEntity, p: Point2D): number | null {
  const dirLen = Math.hypot(xl.direction.x, xl.direction.y);
  if (dirLen < PARAM_EPSILON) return null;
  const ux = xl.direction.x / dirLen;
  const uy = xl.direction.y / dirLen;
  return (p.x - xl.basePoint.x) * ux + (p.y - xl.basePoint.y) * uy;
}

function paramOnCircle(c: CircleEntity, p: Point2D): number {
  return normalizeAngle(Math.atan2(p.y - c.center.y, p.x - c.center.x));
}

function paramOnArc(arc: ArcEntity, p: Point2D): number {
  return normalizeAngle(Math.atan2(p.y - arc.center.y, p.x - arc.center.x));
}

function paramOnEllipseApprox(ell: EllipseEntity, p: Point2D): number {
  const rot = ell.rotation ? (ell.rotation * Math.PI) / 180 : 0;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const dx = p.x - ell.center.x;
  const dy = p.y - ell.center.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const a = ell.majorAxis || PARAM_EPSILON;
  const b = ell.minorAxis || PARAM_EPSILON;
  return normalizeAngle(Math.atan2(ly / b, lx / a));
}

function normalizeAngle(theta: number): number {
  const two = Math.PI * 2;
  let t = theta % two;
  if (t < 0) t += two;
  return t;
}

// ── Tessellation (ellipse / spline approximation) ────────────────────────────

export function tessellateEllipse(
  ell: EllipseEntity,
  segments = TESSELLATION_SEGMENTS,
): Point2D[] {
  const rot = ell.rotation ? (ell.rotation * Math.PI) / 180 : 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const a = ell.majorAxis;
  const b = ell.minorAxis;
  const startParam = ell.startParam ?? 0;
  const endParam = ell.endParam ?? Math.PI * 2;
  const sweep = endParam - startParam;
  const pts: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = startParam + (sweep * i) / segments;
    const lx = a * Math.cos(t);
    const ly = b * Math.sin(t);
    pts.push({
      x: ell.center.x + lx * cos - ly * sin,
      y: ell.center.y + lx * sin + ly * cos,
    });
  }
  return pts;
}

export function tessellateSpline(sp: SplineEntity, segments = TESSELLATION_SEGMENTS): Point2D[] {
  // First-order approximation: tessellate by Catmull-Rom interpolation through
  // control points. Sufficient for trim — matches AutoCAD industry behavior
  // where SPLINE-fit is converted to CV polyline before trim (Q5/Q7).
  const cp = sp.controlPoints;
  if (!cp || cp.length < 2) return [];
  if (cp.length === 2) return [cp[0], cp[1]];

  const out: Point2D[] = [];
  const closed = sp.closed === true;
  const n = cp.length;
  const last = closed ? n : n - 1;

  for (let i = 0; i < last; i++) {
    const p0 = cp[(i - 1 + n) % n] ?? cp[i];
    const p1 = cp[i];
    const p2 = cp[(i + 1) % n] ?? cp[i];
    const p3 = cp[(i + 2) % n] ?? p2;
    const steps = Math.max(1, Math.floor(segments / last));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  if (!closed) out.push(cp[n - 1]);
  return out;
}

function catmullRom(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

// ── Intersection dispatcher ──────────────────────────────────────────────────

function intersectEntities(a: Entity, b: Entity): Point2D[] {
  if (isLineEntity(a) && isLineEntity(b)) return lineLine(a, b);
  if (isLineEntity(a) && (isCircleEntity(b) || isArcEntity(b))) return lineCircleOrArc(a, b);
  if ((isCircleEntity(a) || isArcEntity(a)) && isLineEntity(b)) return lineCircleOrArc(b, a);
  if ((isCircleEntity(a) || isArcEntity(a)) && (isCircleEntity(b) || isArcEntity(b))) return circleCircleOrArc(a, b);

  // Polyline pairs handled via tessellated segments
  const segsA = toSegments(a);
  const segsB = toSegments(b);
  if (segsA && segsB) return segmentsSegments(segsA, segsB);
  if (segsA && (isCircleEntity(b) || isArcEntity(b))) return segmentsCircle(segsA, b);
  if (segsB && (isCircleEntity(a) || isArcEntity(a))) return segmentsCircle(segsB, a);
  if (segsA && isLineEntity(b)) return segmentsSegments(segsA, [{ start: b.start, end: b.end }]);
  if (segsB && isLineEntity(a)) return segmentsSegments([{ start: a.start, end: a.end }], segsB);

  return [];
}

interface Seg {
  readonly start: Point2D;
  readonly end: Point2D;
}

function toSegments(e: Entity): Seg[] | null {
  if (isPolylineEntity(e) || isLWPolylineEntity(e)) {
    return getPolylineSegments(e.vertices, e.closed === true);
  }
  if (isEllipseEntity(e)) return getPolylineSegments(tessellateEllipse(e), false);
  if (isSplineEntity(e)) return getPolylineSegments(tessellateSpline(e), e.closed === true);
  if (isRayEntity(e)) return [extendedSegment(e.basePoint, e.direction, 1)];
  if (isXLineEntity(e)) return [extendedSegment(e.basePoint, e.direction, 2)];
  return null;
}

function extendedSegment(base: Point2D, dir: Point2D, sides: 1 | 2): Seg {
  const L = 1e7;
  const dlen = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / dlen;
  const uy = dir.y / dlen;
  if (sides === 1) {
    return { start: base, end: { x: base.x + ux * L, y: base.y + uy * L } };
  }
  return {
    start: { x: base.x - ux * L, y: base.y - uy * L },
    end: { x: base.x + ux * L, y: base.y + uy * L },
  };
}

function lineLine(a: LineEntity, b: LineEntity): Point2D[] {
  const p = GeometricCalculations.getLineIntersection(a.start, a.end, b.start, b.end);
  return p ? [p] : [];
}

function lineCircleOrArc(line: LineEntity, c: Entity): Point2D[] {
  if (!isCircleEntity(c) && !isArcEntity(c)) return [];
  const pts = GeometricCalculations.getLineCircleIntersections(line.start, line.end, c.center, c.radius);
  return isArcEntity(c) ? pts.filter((p) => angleWithinArc(c, p)) : pts;
}

function circleCircleOrArc(a: Entity, b: Entity): Point2D[] {
  if (!(isCircleEntity(a) || isArcEntity(a)) || !(isCircleEntity(b) || isArcEntity(b))) return [];
  const ca = a as CircleEntity | ArcEntity;
  const cb = b as CircleEntity | ArcEntity;
  let pts = GeometricCalculations.getCircleIntersections(ca.center, ca.radius, cb.center, cb.radius);
  if (isArcEntity(ca)) pts = pts.filter((p) => angleWithinArc(ca, p));
  if (isArcEntity(cb)) pts = pts.filter((p) => angleWithinArc(cb, p));
  return pts;
}

function segmentsSegments(a: Seg[], b: Seg[]): Point2D[] {
  const out: Point2D[] = [];
  for (const sa of a) {
    for (const sb of b) {
      const p = GeometricCalculations.getLineIntersection(sa.start, sa.end, sb.start, sb.end);
      if (p) out.push(p);
    }
  }
  return out;
}

function segmentsCircle(segs: Seg[], c: Entity): Point2D[] {
  if (!isCircleEntity(c) && !isArcEntity(c)) return [];
  const out: Point2D[] = [];
  for (const s of segs) {
    const pts = GeometricCalculations.getLineCircleIntersections(s.start, s.end, c.center, c.radius);
    for (const p of pts) {
      if (isArcEntity(c) && !angleWithinArc(c, p)) continue;
      out.push(p);
    }
  }
  return out;
}

export function angleWithinArc(arc: ArcEntity, p: Point2D): boolean {
  const theta = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  return angleInSweep(theta, arc.startAngle, arc.endAngle, arc.counterclockwise !== false);
}

export function angleInSweep(theta: number, start: number, end: number, ccw: boolean): boolean {
  const two = Math.PI * 2;
  const n = (v: number) => ((v % two) + two) % two;
  const t = n(theta);
  const s = n(start);
  const e = n(end);
  if (ccw) {
    return s <= e ? t >= s - PARAM_EPSILON && t <= e + PARAM_EPSILON : t >= s - PARAM_EPSILON || t <= e + PARAM_EPSILON;
  }
  return s >= e ? t <= s + PARAM_EPSILON && t >= e - PARAM_EPSILON : t <= s + PARAM_EPSILON || t >= e - PARAM_EPSILON;
}

function hasDuplicate(arr: Point2D[], p: Point2D): boolean {
  for (const q of arr) {
    if (Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6) return true;
  }
  return false;
}
