/**
 * TRIM CUT — POLYLINE / LWPOLYLINE / SPLINE — ADR-350
 *
 * Pure cut functions for composite curve entities.
 * Closed polyline interior cut → "opens" the polyline (closed=false, same ID,
 * remove interior segment) per G1.
 *
 * SPLINE flow: tessellate via {@link tessellateSpline}, treat as polyline,
 * remap result back to SPLINE control points (Q7 silent fit→CV conversion).
 *
 * @see trim-entity-cutter.ts for the dispatcher.
 */

import type { Point2D } from '../../rendering/types/Types';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
import {
  type Entity,
  type LWPolylineEntity,
  type PolylineEntity,
  type SplineEntity,
} from '../../types/entities';
import { paramOnLineSegment, paramOnPolyline, tessellateSpline } from './trim-intersection-mapper';
import type { TrimOperation, TrimResult } from './trim-types';
import {
  deleteOp,
  EMPTY_RESULT,
  PARAM_EPSILON,
  promoteOp,
  shortenOp,
  splitOp,
} from './trim-cut-shared';
import type { CutContext } from './trim-line-arc-cutter';

type AnyPoly = PolylineEntity | LWPolylineEntity;

// ── Public ────────────────────────────────────────────────────────────────────

export function cutPolyline(pl: AnyPoly, ctx: CutContext): TrimResult {
  const segments = getPolylineSegments(pl.vertices, pl.closed === true);
  const cuts = buildPolylineCuts(ctx.intersections, segments);
  if (cuts.length === 0) {
    return ctx.mode === 'quick' ? { operations: [deleteOp(pl)] } : EMPTY_RESULT;
  }
  const pickParam = paramOnPolyline(pl, ctx.pickPoint);
  if (!pickParam) return EMPTY_RESULT;
  return slicePolyline(pl, cuts, pickParam.segmentIndex + pickParam.t, segments, ctx.newId);
}

export function cutSpline(sp: SplineEntity, ctx: CutContext): TrimResult {
  const tess = tessellateSpline(sp);
  if (tess.length < 2) return EMPTY_RESULT;
  const pseudoPoly: PolylineEntity = {
    id: sp.id,
    type: 'polyline',
    vertices: tess,
    closed: sp.closed === true,
    layer: sp.layer,
    visible: sp.visible,
  };
  const result = cutPolyline(pseudoPoly, ctx);
  return { operations: result.operations.map((op) => promotePolyOpBackToSpline(op, sp)) };
}

function promotePolyOpBackToSpline(op: TrimOperation, source: SplineEntity): TrimOperation {
  if (op.kind === 'shorten') {
    return {
      kind: 'shorten',
      entityId: source.id,
      originalGeom: source,
      newGeom: polyToSpline(source, op.newGeom as PolylineEntity),
    };
  }
  if (op.kind === 'split') {
    return {
      kind: 'split',
      entityId: source.id,
      originalGeom: source,
      replacements: op.replacements.map((r) => polyToSpline(source, r as PolylineEntity)),
    };
  }
  if (op.kind === 'delete') {
    return { kind: 'delete', entityId: source.id, originalGeom: source };
  }
  return op;
}

function polyToSpline(source: SplineEntity, poly: PolylineEntity): SplineEntity {
  return {
    ...source,
    id: poly.id ?? source.id,
    controlPoints: [...poly.vertices],
    closed: poly.closed === true,
  };
}

// ── Polyline cut math ────────────────────────────────────────────────────────

interface PolylineCut {
  readonly segmentIndex: number;
  readonly t: number;
  readonly point: Point2D;
  /** Linear flow parameter for ordering: segmentIndex + t. */
  readonly flow: number;
}

function buildPolylineCuts(
  pts: ReadonlyArray<Point2D>,
  segments: ReadonlyArray<{ start: Point2D; end: Point2D }>,
): PolylineCut[] {
  const out: PolylineCut[] = [];
  for (const p of pts) {
    const cut = nearestCutForPoint(p, segments);
    if (cut) out.push(cut);
  }
  out.sort((a, b) => a.flow - b.flow);
  return dedupeCuts(out);
}

function nearestCutForPoint(
  p: Point2D,
  segments: ReadonlyArray<{ start: Point2D; end: Point2D }>,
): PolylineCut | null {
  let best: PolylineCut | null = null;
  let bestD2 = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const t = paramOnLineSegment(segments[i].start, segments[i].end, p);
    if (t === null) continue;
    if (t < PARAM_EPSILON || t > 1 - PARAM_EPSILON) continue;
    const proj = projectOnSeg(segments[i], t);
    const d2 = (proj.x - p.x) ** 2 + (proj.y - p.y) ** 2;
    if (d2 > 1e-4 || d2 >= bestD2) continue;
    bestD2 = d2;
    best = { segmentIndex: i, t, point: proj, flow: i + t };
  }
  return best;
}

function dedupeCuts(cuts: PolylineCut[]): PolylineCut[] {
  const out: PolylineCut[] = [];
  for (const c of cuts) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.flow - c.flow) < PARAM_EPSILON) continue;
    out.push(c);
  }
  return out;
}

function projectOnSeg(seg: { start: Point2D; end: Point2D }, t: number): Point2D {
  return {
    x: seg.start.x + t * (seg.end.x - seg.start.x),
    y: seg.start.y + t * (seg.end.y - seg.start.y),
  };
}

function slicePolyline(
  pl: AnyPoly,
  cuts: ReadonlyArray<PolylineCut>,
  pickFlow: number,
  segments: ReadonlyArray<{ start: Point2D; end: Point2D }>,
  newId: () => string,
): TrimResult {
  const flows = [0, ...cuts.map((c) => c.flow), segments.length];
  const idx = findFlowSegment(flows, pickFlow);
  if (idx < 0) return EMPTY_RESULT;
  const closed = pl.closed === true;

  if (closed && cuts.length >= 1) return openClosedPolyline(pl, cuts, idx);

  const remaining: Array<[number, number]> = [];
  for (let i = 0; i < flows.length - 1; i++) {
    if (i !== idx) remaining.push([flows[i], flows[i + 1]]);
  }
  if (remaining.length === 0) return { operations: [deleteOp(pl)] };
  if (remaining.length === 1) {
    return {
      operations: [shortenOp(pl, polylineSlice(pl, remaining[0][0], remaining[0][1], cuts))],
    };
  }
  const replacements = remaining.map(([a, b]) => ({
    ...polylineSlice(pl, a, b, cuts),
    id: newId(),
  }));
  return { operations: [splitOp(pl, replacements)] };
}

function findFlowSegment(flows: ReadonlyArray<number>, pickFlow: number): number {
  for (let i = 0; i < flows.length - 1; i++) {
    if (pickFlow >= flows[i] - PARAM_EPSILON && pickFlow <= flows[i + 1] + PARAM_EPSILON) return i;
  }
  return -1;
}

function polylineSlice(
  pl: AnyPoly,
  flowStart: number,
  flowEnd: number,
  cuts: ReadonlyArray<PolylineCut>,
): AnyPoly {
  const verts: Point2D[] = [];
  const startCut = findCutAt(cuts, flowStart);
  const endCut = findCutAt(cuts, flowEnd);
  if (startCut) verts.push(startCut.point);
  else verts.push(pl.vertices[Math.round(flowStart)]);

  const firstWhole = Math.ceil(flowStart);
  const lastWhole = Math.floor(flowEnd);
  for (let i = firstWhole; i <= lastWhole && i < pl.vertices.length; i++) {
    pushVertex(verts, pl.vertices[i]);
  }
  if (endCut) verts.push(endCut.point);
  return { ...pl, vertices: verts, closed: false } as AnyPoly;
}

function pushVertex(verts: Point2D[], v: Point2D): void {
  const last = verts[verts.length - 1];
  if (!last || last.x !== v.x || last.y !== v.y) verts.push(v);
}

function findCutAt(cuts: ReadonlyArray<PolylineCut>, flow: number): PolylineCut | null {
  for (const c of cuts) if (Math.abs(c.flow - flow) < PARAM_EPSILON) return c;
  return null;
}

function openClosedPolyline(
  pl: AnyPoly,
  cuts: ReadonlyArray<PolylineCut>,
  removedIdx: number,
): TrimResult {
  // Closed polyline → first interior cut opens it (G1). Keep ID, closed=false.
  const flows = [0, ...cuts.map((c) => c.flow), pl.vertices.length];
  const removeStart = flows[removedIdx];
  const removeEnd = flows[removedIdx + 1];
  const startCut = findCutAt(cuts, removeEnd);
  const endCut = findCutAt(cuts, removeStart);

  const verts: Point2D[] = [];
  if (startCut) verts.push(startCut.point);
  const startIdx = Math.ceil(removeEnd);
  for (let i = 0; i < pl.vertices.length; i++) {
    const k = (startIdx + i) % pl.vertices.length;
    if (k >= removeStart && k <= removeEnd) continue;
    pushVertex(verts, pl.vertices[k]);
  }
  if (endCut) pushVertex(verts, endCut.point);

  const opened = { ...pl, vertices: verts, closed: false } as AnyPoly;
  return { operations: [shortenOp(pl, opened)] };
}

// Demote unused import (LWPolylineEntity inferred via AnyPoly)
export type _UnusedLW = LWPolylineEntity;
// `Entity` re-imported only for op typing; silence ts unused.
export type _UnusedEntity = Entity;
