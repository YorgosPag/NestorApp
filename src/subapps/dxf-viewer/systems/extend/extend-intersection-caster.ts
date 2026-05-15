/**
 * EXTEND INTERSECTION CASTER — ADR-353
 *
 * SSoT for the "forward-ray cast from endpoint to nearest boundary" math used
 * by the EXTEND command. Pure functions — no state, no side effects.
 *
 * Algorithm per entity type:
 *  - LINE: extend the endpoint nearest to pickPoint along the line's natural
 *    direction, find first boundary intersection with t > ε.
 *  - ARC: extend the angle-endpoint nearest to pickPoint along the arc's circle,
 *    find first angle on the full circle that is outside the current arc span
 *    and nearest to the extending endpoint.
 *  - Open POLYLINE: locate terminal segment (first or last), apply line extension
 *    to its open endpoint, update the terminal vertex.
 *  - Closed or unsupported entities → null (silent no-op, ADR-353 Q2).
 *
 * SSoT reuse:
 *  - Boundary resolution → `trim-boundary-resolver::resolveCuttingEdges`
 *  - Intersection math → `trim-intersection-mapper::computeIntersectionPoints`
 *  - Polyline segments → `geometry-rendering-utils::getPolylineSegments`
 *  - Type guards → `types/entities`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-353-extend-command.md §Core Mathematics
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
  type LWPolylineEntity,
  type PolylineEntity,
  type RayEntity,
} from '../../types/entities';
import { computeIntersectionPoints, angleInSweep } from '../trim/trim-intersection-mapper';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { CuttingEdge } from '../trim/trim-types';
import type { ExtendOperation } from './extend-types';

const FORWARD_EPS = 1e-6;
const RAY_LENGTH = 1e7;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute an ExtendOperation for a single entity + pick, or null if no
 * boundary is found (silent no-op per ADR-353 Q2).
 */
export function castExtendIntersection(
  entity: Entity,
  pickPoint: Point2D,
  boundaries: ReadonlyArray<CuttingEdge>,
): ExtendOperation | null {
  if (isLineEntity(entity)) return extendLine(entity, pickPoint, boundaries);
  if (isArcEntity(entity)) return extendArc(entity, pickPoint, boundaries);
  if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
    return extendPolyline(entity, pickPoint, boundaries);
  }
  return null;
}

/**
 * Returns true if this entity type can be extended by the EXTEND command.
 * Closed polylines, circles, and non-curve types silently return false.
 */
export function isExtendable(entity: Entity): boolean {
  if (isLineEntity(entity)) return true;
  if (isArcEntity(entity)) return true;
  if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
    return entity.closed !== true;
  }
  return false;
}

// ── LINE ──────────────────────────────────────────────────────────────────────

function extendLine(
  line: LineEntity,
  pickPoint: Point2D,
  boundaries: ReadonlyArray<CuttingEdge>,
): ExtendOperation | null {
  const dStart = dist2(pickPoint, line.start);
  const dEnd = dist2(pickPoint, line.end);
  const extendingStart = dStart < dEnd;
  const extPt = extendingStart ? line.start : line.end;
  const fixedPt = extendingStart ? line.end : line.start;

  const dx = extPt.x - fixedPt.x;
  const dy = extPt.y - fixedPt.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const ux = dx / len;
  const uy = dy / len;

  const bestPt = forwardRayNearest(extPt, ux, uy, line.id, boundaries);
  if (!bestPt) return null;

  const newLine: LineEntity = extendingStart
    ? { ...line, start: bestPt }
    : { ...line, end: bestPt };

  return { kind: 'extend', entityId: line.id, originalGeom: line, newGeom: newLine };
}

// ── ARC ───────────────────────────────────────────────────────────────────────

function extendArc(
  arc: ArcEntity,
  pickPoint: Point2D,
  boundaries: ReadonlyArray<CuttingEdge>,
): ExtendOperation | null {
  const startPt = arcEndpoint(arc, arc.startAngle);
  const endPt = arcEndpoint(arc, arc.endAngle);
  const extendingStart = dist2(pickPoint, startPt) < dist2(pickPoint, endPt);

  const virtualCircle: Entity = {
    id: arc.id + '_virt',
    type: 'circle',
    center: arc.center,
    radius: arc.radius,
    layer: arc.layer,
    visible: arc.visible,
  } as unknown as Entity;

  const selfExcluded = boundaries.filter((b) => b.sourceEntityId !== arc.id);
  const intersections = computeIntersectionPoints(virtualCircle, selfExcluded);

  const ccw = arc.counterclockwise !== false;
  const two = Math.PI * 2;
  const normalize = (a: number): number => ((a % two) + two) % two;

  let bestAngle: number | null = null;
  let bestDelta = Infinity;

  for (const p of intersections) {
    const theta = normalize(Math.atan2(p.y - arc.center.y, p.x - arc.center.x));
    if (angleInSweep(theta, arc.startAngle, arc.endAngle, ccw)) continue;

    const delta = extendingStart
      ? angularDistanceBefore(theta, arc.startAngle, ccw)
      : angularDistanceAfter(theta, arc.endAngle, ccw);

    if (delta > FORWARD_EPS && delta < bestDelta) {
      bestDelta = delta;
      bestAngle = theta;
    }
  }

  if (bestAngle === null) return null;

  const newArc: ArcEntity = extendingStart
    ? { ...arc, startAngle: bestAngle }
    : { ...arc, endAngle: bestAngle };

  return { kind: 'extend', entityId: arc.id, originalGeom: arc, newGeom: newArc };
}

// ── POLYLINE ──────────────────────────────────────────────────────────────────

function extendPolyline(
  poly: PolylineEntity | LWPolylineEntity,
  pickPoint: Point2D,
  boundaries: ReadonlyArray<CuttingEdge>,
): ExtendOperation | null {
  if (poly.closed === true) return null;
  const verts = poly.vertices;
  if (!verts || verts.length < 2) return null;

  const firstVert = verts[0];
  const lastVert = verts[verts.length - 1];
  if (!firstVert || !lastVert) return null;

  const dFirst = dist2(pickPoint, firstVert);
  const dLast = dist2(pickPoint, lastVert);
  const extendingStart = dFirst < dLast;

  let ux: number;
  let uy: number;
  let extPt: Point2D;

  if (extendingStart) {
    const seg = getPolylineSegments(verts, false)[0];
    if (!seg) return null;
    extPt = seg.start;
    const dx = seg.start.x - seg.end.x;
    const dy = seg.start.y - seg.end.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;
    ux = dx / len;
    uy = dy / len;
  } else {
    const segs = getPolylineSegments(verts, false);
    const seg = segs[segs.length - 1];
    if (!seg) return null;
    extPt = seg.end;
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return null;
    ux = dx / len;
    uy = dy / len;
  }

  const bestPt = forwardRayNearest(extPt, ux, uy, poly.id, boundaries);
  if (!bestPt) return null;

  const newVerts = [...verts];
  if (extendingStart) {
    newVerts[0] = { ...firstVert, x: bestPt.x, y: bestPt.y };
  } else {
    newVerts[newVerts.length - 1] = { ...lastVert, x: bestPt.x, y: bestPt.y };
  }
  const newPoly = { ...poly, vertices: newVerts };

  return {
    kind: 'extend',
    entityId: poly.id,
    originalGeom: poly,
    newGeom: newPoly as unknown as Entity,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cast a virtual RAY from `origin` in unit direction (ux, uy), return nearest forward intersection. */
function forwardRayNearest(
  origin: Point2D,
  ux: number,
  uy: number,
  selfId: string,
  boundaries: ReadonlyArray<CuttingEdge>,
): Point2D | null {
  const far: Point2D = { x: origin.x + ux * RAY_LENGTH, y: origin.y + uy * RAY_LENGTH };
  const virtualLine: Entity = {
    id: selfId + '_ray',
    type: 'line',
    start: origin,
    end: far,
  } as unknown as Entity;

  const selfExcluded: CuttingEdge[] = boundaries.filter((b) => b.sourceEntityId !== selfId).map((b) => b);
  const intersections = computeIntersectionPoints(virtualLine as unknown as Parameters<typeof computeIntersectionPoints>[0], selfExcluded);

  let bestT = Infinity;
  let bestPt: Point2D | null = null;

  for (const p of intersections) {
    const t = (p.x - origin.x) * ux + (p.y - origin.y) * uy;
    if (t > FORWARD_EPS && t < bestT) {
      bestT = t;
      bestPt = p;
    }
  }
  return bestPt;
}

function arcEndpoint(arc: ArcEntity, angle: number): Point2D {
  return {
    x: arc.center.x + arc.radius * Math.cos(angle),
    y: arc.center.y + arc.radius * Math.sin(angle),
  };
}

function dist2(a: Point2D, b: { x: number; y: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** Angular distance from currentAngle "before" it (the direction we extend startAngle CW for CCW arcs). */
function angularDistanceBefore(theta: number, currentAngle: number, ccw: boolean): number {
  const two = Math.PI * 2;
  const n = (a: number): number => ((a % two) + two) % two;
  const t = n(theta);
  const c = n(currentAngle);
  return ccw
    ? ((c - t + two) % two)
    : ((t - c + two) % two);
}

/** Angular distance from currentAngle "after" it (the direction we extend endAngle CCW for CCW arcs). */
function angularDistanceAfter(theta: number, currentAngle: number, ccw: boolean): number {
  const two = Math.PI * 2;
  const n = (a: number): number => ((a % two) + two) % two;
  const t = n(theta);
  const c = n(currentAngle);
  return ccw
    ? ((t - c + two) % two)
    : ((c - t + two) % two);
}
