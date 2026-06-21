/**
 * GEOMETRY BULGE UTILITIES — SSoT for polyline arc segments (ADR-510 Φ3a)
 *
 * A "bulge" is the AutoCAD LWPOLYLINE per-segment arc factor (DXF group 42):
 *   bulge = tan(θ / 4)
 * where θ is the signed included angle of the arc spanning the segment
 * `vertices[i] → vertices[i+1]`. Sign convention (AutoCAD):
 *   bulge > 0 → counterclockwise arc (CCW sweep)
 *   bulge < 0 → clockwise arc
 *   bulge = 0 → straight segment
 *
 * This is the ONE geometry source feeding canvas renderer + DXF writer +
 * measurements (ADR-510 §4.1 «μία γεωμετρία → canvas + DXF + μέτρηση»).
 * No bulge↔arc math may be duplicated elsewhere — promote new callers here.
 */

import type { Point2D } from '../../types/Types';

/** Below this |bulge| (and chord length) a segment is treated as straight. */
export const BULGE_STRAIGHT_EPS = 1e-9;

const TWO_PI = Math.PI * 2;

/**
 * Tessellate a circular arc given a SIGNED sweep (CCW positive, CW negative).
 * Private to this module — the existing public `arcToPolyline`
 * (`utils/geometry/GeometryUtils.ts`, ADR-166) is degree-based and CCW-only, so
 * it cannot represent a negative-bulge (CW) arc. Consolidating the codebase's
 * ~8 arc tessellators into one signed SSoT is tracked as a separate ratchet.
 */
function tessellateSignedArc(
  center: Point2D,
  radius: number,
  startAngleRad: number,
  sweepRad: number,
  maxSegDeg: number
): Point2D[] {
  const sweepDeg = Math.abs(sweepRad) * (180 / Math.PI);
  const steps = Math.max(2, Math.ceil(sweepDeg / Math.max(1e-6, maxSegDeg)));
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = startAngleRad + (sweepRad * i) / steps;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}

export interface BulgeArc {
  /** Arc center. */
  center: Point2D;
  /** Arc radius (always ≥ 0). */
  radius: number;
  /** Start angle at p0 (radians). */
  startAngle: number;
  /** End angle at p1 (radians). */
  endAngle: number;
  /** Signed sweep (radians); CCW positive. */
  sweep: number;
  /** Counterclockwise flag (true ⇔ bulge > 0). */
  counterclockwise: boolean;
  /** Perpendicular chord→apex height (sagitta, ≥ 0). */
  sagitta: number;
}

/** True when the segment carries no arc (missing/near-zero bulge). */
export function isStraightSegment(bulge: number | undefined | null): boolean {
  return bulge == null || Math.abs(bulge) < BULGE_STRAIGHT_EPS;
}

/**
 * Resolve the arc of a bulged segment `p0 → p1`.
 * Returns null for straight or degenerate (zero-length chord) segments.
 */
export function bulgeToArc(p0: Point2D, p1: Point2D, bulge: number): BulgeArc | null {
  if (isStraightSegment(bulge)) return null;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const chord = Math.hypot(dx, dy);
  if (chord < BULGE_STRAIGHT_EPS) return null;

  // Center on the chord's perpendicular bisector (AutoCAD bulge formula).
  const cot = (1 / bulge - bulge) / 2;
  const center: Point2D = {
    x: (p0.x + p1.x) / 2 + (cot * (p0.y - p1.y)) / 2,
    y: (p0.y + p1.y) / 2 + (cot * (p1.x - p0.x)) / 2,
  };
  const radius = Math.hypot(p0.x - center.x, p0.y - center.y);
  return {
    center,
    radius,
    startAngle: Math.atan2(p0.y - center.y, p0.x - center.x),
    endAngle: Math.atan2(p1.y - center.y, p1.x - center.x),
    sweep: 4 * Math.atan(bulge),
    counterclockwise: bulge > 0,
    sagitta: (Math.abs(bulge) * chord) / 2,
  };
}

/**
 * Tessellate a bulged segment into a polyline (inclusive of both endpoints).
 * Straight segments return `[p0, p1]`. Endpoints are pinned to avoid float drift.
 */
export function bulgeToPolyline(
  p0: Point2D,
  p1: Point2D,
  bulge: number,
  maxSegDeg = 12
): Point2D[] {
  const arc = bulgeToArc(p0, p1, bulge);
  if (!arc) return [{ ...p0 }, { ...p1 }];
  const pts = tessellateSignedArc(arc.center, arc.radius, arc.startAngle, arc.sweep, maxSegDeg);
  pts[0] = { ...p0 };
  pts[pts.length - 1] = { ...p1 };
  return pts;
}

/**
 * The arc apex (sagitta point) — the natural anchor for a bulge grip handle.
 * For a straight segment this is the chord midpoint.
 * Positive bulge bulges toward the (dy, -dx)/|chord| normal.
 */
export function bulgeApexPoint(p0: Point2D, p1: Point2D, bulge: number): Point2D {
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  if (isStraightSegment(bulge)) return { x: mx, y: my };
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const L = Math.hypot(dx, dy);
  if (L < BULGE_STRAIGHT_EPS) return { x: mx, y: my };
  const h = (bulge * L) / 2;
  return { x: mx + (dy / L) * h, y: my + (-dx / L) * h };
}

/**
 * Inverse of {@link bulgeApexPoint}: signed bulge from an apex handle dragged
 * to `t`. Projects `t` onto the chord's perpendicular at the midpoint, so the
 * handle is constrained to the symmetric apex (Revit-style bulge drag).
 */
export function bulgeFromApexPoint(p0: Point2D, p1: Point2D, t: Point2D): number {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const L = Math.hypot(dx, dy);
  if (L < BULGE_STRAIGHT_EPS) return 0;
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  const h = ((t.x - mx) * dy + (t.y - my) * -dx) / L;
  return (2 * h) / L;
}

/** True when at least one segment of the polyline carries a real arc. */
export function hasAnyBulge(bulges: readonly number[] | undefined | null): boolean {
  return !!bulges && bulges.some(b => !isStraightSegment(b));
}

/**
 * Expand a (possibly bulged) polyline into a flat tessellated point path.
 * This is the SSoT geometry shared by the renderer, hit-test and bbox: every
 * arc segment is tessellated via {@link bulgeToPolyline}, straight segments
 * pass through unchanged. For `closed` the closing segment (last → first) is
 * appended, so the returned path already forms the full loop.
 *
 * @param vertices - Polyline vertices
 * @param bulges - Per-segment arc factors (index-aligned with vertices); the
 *                 bulge at index i applies to segment vertices[i] → [i+1]
 * @param closed - Whether to append the closing segment
 * @param maxSegDeg - Max angular step per tessellation chord (default 12°)
 */
export function expandPolyline(
  vertices: readonly Point2D[],
  bulges: readonly number[] | undefined,
  closed = false,
  maxSegDeg = 12
): Point2D[] {
  const n = vertices.length;
  if (n < 2) return vertices.map(v => ({ ...v }));
  const out: Point2D[] = [];
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const seg = bulgeToPolyline(a, b, bulges?.[i] ?? 0, maxSegDeg);
    if (out.length === 0) out.push(...seg);
    else out.push(...seg.slice(1)); // drop the vertex shared with previous segment
  }
  return out;
}

/** True when `angle` (radians) lies within the signed sweep from `start`. */
function angleInSweep(angle: number, start: number, sweep: number): boolean {
  let delta = angle - start;
  if (sweep >= 0) {
    while (delta < 0) delta += TWO_PI;
    while (delta > TWO_PI) delta -= TWO_PI;
    return delta <= sweep + 1e-12;
  }
  while (delta > 0) delta -= TWO_PI;
  while (delta < -TWO_PI) delta += TWO_PI;
  return delta >= sweep - 1e-12;
}

/**
 * Extreme points of a bulged segment for bounding-box / hit-test envelopes.
 * An arc can bulge beyond its chord, so this returns the endpoints PLUS any of
 * the four cardinal circle points (rightmost/top/leftmost/bottom) that fall
 * inside the arc's sweep. Straight segments return just the endpoints.
 */
export function bulgeSegmentExtremes(p0: Point2D, p1: Point2D, bulge: number): Point2D[] {
  const arc = bulgeToArc(p0, p1, bulge);
  if (!arc) return [{ ...p0 }, { ...p1 }];
  const { center, radius, startAngle, sweep } = arc;
  const pts: Point2D[] = [{ ...p0 }, { ...p1 }];
  const cardinals = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (const a of cardinals) {
    if (angleInSweep(a, startAngle, sweep)) {
      pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
    }
  }
  return pts;
}
