/**
 * TRIM CUT — LINE / ARC / CIRCLE / ELLIPSE — ADR-350
 *
 * Pure cut functions for "smooth" curve entities (no internal vertices).
 * Type-promotions:
 *   - CIRCLE → ARC (always — Q5)
 *   - ELLIPSE → ELLIPTICAL ARC (always — Q5)
 *
 * @see trim-entity-cutter.ts for the dispatcher.
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  type ArcEntity,
  type CircleEntity,
  type EllipseEntity,
  type Entity,
  type LineEntity,
} from '../../types/entities';
import { angleInSweep, paramOnLineSegment } from './trim-intersection-mapper';
import type { TrimResult } from './trim-types';
import {
  buildSegments,
  dedupeSorted,
  deleteIfNoIntersections,
  deleteOp,
  EMPTY_RESULT,
  findSegmentContaining,
  PARAM_EPSILON,
  promoteOp,
  shortenOp,
  splitOp,
} from './trim-cut-shared';

interface CutContext {
  readonly intersections: ReadonlyArray<Point2D>;
  readonly pickPoint: Point2D;
  readonly mode: 'quick' | 'standard';
  readonly newId: () => string;
}

// ── LINE ──────────────────────────────────────────────────────────────────────

export function cutLine(line: LineEntity, ctx: CutContext): TrimResult {
  const ts = mapPointsToLineParams(line, ctx.intersections);
  const pickT = paramOnLineSegment(line.start, line.end, ctx.pickPoint);
  if (pickT === null) return EMPTY_RESULT;
  return deleteIfNoIntersections(line, ts, ctx.mode) ?? sliceLine(line, ts, pickT, ctx.newId);
}

function mapPointsToLineParams(line: LineEntity, pts: ReadonlyArray<Point2D>): number[] {
  const out: number[] = [];
  for (const p of pts) {
    const t = paramOnLineSegment(line.start, line.end, p);
    if (t === null) continue;
    if (t > PARAM_EPSILON && t < 1 - PARAM_EPSILON) out.push(t);
  }
  return dedupeSorted(out);
}

function sliceLine(line: LineEntity, ts: number[], pickT: number, newId: () => string): TrimResult {
  const segs = buildSegments(0, 1, ts);
  const idx = findSegmentContaining(segs, pickT);
  if (idx < 0) return EMPTY_RESULT;
  const remaining = segs.filter((_, i) => i !== idx);
  if (remaining.length === 0) return { operations: [deleteOp(line)] };
  if (remaining.length === 1) {
    return { operations: [shortenOp(line, lineFromParams(line, remaining[0]))] };
  }
  const replacements = remaining.map((r) => ({ ...lineFromParams(line, r), id: newId() }));
  return { operations: [splitOp(line, replacements)] };
}

function lineFromParams(line: LineEntity, [t0, t1]: [number, number]): LineEntity {
  return { ...line, start: lerpOnLine(line, t0), end: lerpOnLine(line, t1) };
}

function lerpOnLine(line: LineEntity, t: number): Point2D {
  return {
    x: line.start.x + t * (line.end.x - line.start.x),
    y: line.start.y + t * (line.end.y - line.start.y),
  };
}

// ── ARC ───────────────────────────────────────────────────────────────────────

export function cutArc(arc: ArcEntity, ctx: CutContext): TrimResult {
  const sweep = arcSweep(arc);
  const ts = pointsToArcParams(arc, ctx.intersections, sweep);
  const pickT = pointToArcParam(arc, ctx.pickPoint, sweep);
  if (pickT === null) return EMPTY_RESULT;
  return deleteIfNoIntersections(arc, ts, ctx.mode) ?? sliceArc(arc, ts, pickT, sweep, ctx.newId);
}

interface ArcSweep {
  readonly start: number;
  readonly total: number;
  readonly ccw: boolean;
}

function arcSweep(arc: ArcEntity): ArcSweep {
  const ccw = arc.counterclockwise !== false;
  const two = Math.PI * 2;
  let total = ccw ? arc.endAngle - arc.startAngle : arc.startAngle - arc.endAngle;
  total = ((total % two) + two) % two;
  return { start: arc.startAngle, total, ccw };
}

function pointsToArcParams(arc: ArcEntity, pts: ReadonlyArray<Point2D>, sweep: ArcSweep): number[] {
  const out: number[] = [];
  for (const p of pts) {
    const t = pointToArcParam(arc, p, sweep);
    if (t === null) continue;
    if (t > PARAM_EPSILON && t < 1 - PARAM_EPSILON) out.push(t);
  }
  return dedupeSorted(out);
}

function pointToArcParam(arc: ArcEntity, p: Point2D, sweep: ArcSweep): number | null {
  const theta = Math.atan2(p.y - arc.center.y, p.x - arc.center.x);
  if (!angleInSweep(theta, arc.startAngle, arc.endAngle, sweep.ccw)) return null;
  if (sweep.total < 1e-9) return null;
  const two = Math.PI * 2;
  let delta = sweep.ccw ? theta - sweep.start : sweep.start - theta;
  delta = ((delta % two) + two) % two;
  return delta / sweep.total;
}

function sliceArc(
  arc: ArcEntity,
  ts: number[],
  pickT: number,
  sweep: ArcSweep,
  newId: () => string,
): TrimResult {
  const segs = buildSegments(0, 1, ts);
  const idx = findSegmentContaining(segs, pickT);
  if (idx < 0) return EMPTY_RESULT;
  const remaining = segs.filter((_, i) => i !== idx);
  if (remaining.length === 0) return { operations: [deleteOp(arc)] };
  if (remaining.length === 1) {
    return { operations: [shortenOp(arc, arcFromParams(arc, remaining[0], sweep))] };
  }
  const replacements = remaining.map((r) => ({ ...arcFromParams(arc, r, sweep), id: newId() }));
  return { operations: [splitOp(arc, replacements)] };
}

function arcFromParams(arc: ArcEntity, [t0, t1]: [number, number], sweep: ArcSweep): ArcEntity {
  const startAngle = sweep.ccw ? sweep.start + sweep.total * t0 : sweep.start - sweep.total * t0;
  const endAngle = sweep.ccw ? sweep.start + sweep.total * t1 : sweep.start - sweep.total * t1;
  return { ...arc, startAngle, endAngle };
}

// ── CIRCLE → ARC ──────────────────────────────────────────────────────────────

export function cutCircle(circle: CircleEntity, ctx: CutContext): TrimResult {
  if (ctx.intersections.length < 2) {
    return ctx.mode === 'quick' ? { operations: [deleteOp(circle)] } : EMPTY_RESULT;
  }
  const angles = ctx.intersections
    .map((p) => Math.atan2(p.y - circle.center.y, p.x - circle.center.x))
    .sort((a, b) => a - b);
  const pickAngle = Math.atan2(ctx.pickPoint.y - circle.center.y, ctx.pickPoint.x - circle.center.x);
  const [a, b] = pickArcRange(angles, pickAngle);
  const arc: ArcEntity = {
    id: circle.id,
    type: 'arc',
    center: circle.center,
    radius: circle.radius,
    startAngle: a,
    endAngle: b,
    counterclockwise: true,
    layer: circle.layer,
    visible: circle.visible,
  };
  return { operations: [promoteOp(circle, arc, 'arc')] };
}

function pickArcRange(sortedAngles: number[], pickAngle: number): [number, number] {
  const two = Math.PI * 2;
  const n = sortedAngles.length;
  for (let i = 0; i < n; i++) {
    const a = sortedAngles[i];
    const b = sortedAngles[(i + 1) % n];
    if (angleInRange(pickAngle, a, b)) return [b, a + (i === n - 1 ? two : 0)];
  }
  return [sortedAngles[0], sortedAngles[1]];
}

function angleInRange(theta: number, a: number, b: number): boolean {
  const two = Math.PI * 2;
  const n = (v: number) => ((v % two) + two) % two;
  const t = n(theta);
  const aa = n(a);
  const bb = n(b);
  return aa <= bb ? t >= aa && t <= bb : t >= aa || t <= bb;
}

// ── ELLIPSE → ELLIPTICAL ARC ──────────────────────────────────────────────────

export function cutEllipse(ell: EllipseEntity, ctx: CutContext): TrimResult {
  if (ctx.intersections.length < 2) {
    return ctx.mode === 'quick' ? { operations: [deleteOp(ell)] } : EMPTY_RESULT;
  }
  const params = ctx.intersections.map((p) => ellipseParam(ell, p)).sort((a, b) => a - b);
  const pickParam = ellipseParam(ell, ctx.pickPoint);
  const [a, b] = pickArcRange(params, pickParam);
  const promoted: EllipseEntity = { ...ell, startParam: b, endParam: a + Math.PI * 2 };
  return { operations: [promoteOp(ell, promoted, 'ellipse')] };
}

function ellipseParam(ell: EllipseEntity, p: Point2D): number {
  const rot = ell.rotation ? (ell.rotation * Math.PI) / 180 : 0;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const dx = p.x - ell.center.x;
  const dy = p.y - ell.center.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.atan2(ly / (ell.minorAxis || 1), lx / (ell.majorAxis || 1));
}

export type { CutContext };
