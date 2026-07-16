/**
 * Parametric Line Intersection Core
 *
 * SSoT for "unbounded parametric line × primitive" intersection math
 * (ADR-359 §7 / CLAUDE.md N.18).
 *
 * XLINE and RAY are the same solver. Both parametrise as `basePoint + t·direction`
 * and differ in exactly one thing: which values of `t` they accept.
 *   - XLine is infinite in both directions → `|t| <= XLINE_MAX_T`
 *   - Ray is semi-infinite, forward only   → `t >= -XLINE_EPSILON`
 * That predicate is the `TAccept` parameter; every other line of math is shared.
 *
 * Segment-bounded intersections (`t, u ∈ [0,1]`, parametrised by two endpoints)
 * are a different representation and live in `../shared/GeometricCalculations`.
 *
 * @module snapping/engines/parametric-line-intersection-core
 */

import type { Point2D } from '../../rendering/types/Types';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { Entity } from '../extended-types';
import type { IntersectionResult } from '../shared/GeometricCalculations';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { isPolylineEntity, isLWPolylineEntity, isRectangleEntity } from '../../types/entities';

export const XLINE_EPSILON = 1e-10;
export const XLINE_MAX_T = 1e8;

/** An unbounded line in `basePoint + t·direction` form. Both XLineEntity and RayEntity satisfy it. */
export interface ParametricLine {
  basePoint: Point2D;
  direction: Point2D;
}

/** Decides which parameter values along the line count as "on" it. The only XLine/Ray difference. */
export type TAccept = (t: number) => boolean;

export const acceptRayT: TAccept = (t) => t >= -XLINE_EPSILON;
export const acceptXlineT: TAccept = (t) => Math.abs(t) <= XLINE_MAX_T;

interface CircleLike {
  center: Point2D;
  radius: number;
}

interface ArcLike extends CircleLike {
  startAngle: number;
  endAngle: number;
}

interface EllipseLike {
  center: Point2D;
  majorAxis: number;
  minorAxis: number;
  rotation?: number;
  startParam?: number;
  endParam?: number;
}

interface Segment {
  start: Point2D;
  end: Point2D;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

export function cross2D(a: Point2D, b: Point2D): number {
  return a.x * b.y - a.y * b.x;
}

export function isAngleInRange(angleDeg: number, startDeg: number, endDeg: number): boolean {
  const a = normalizeAngleDeg(angleDeg);
  const s = normalizeAngleDeg(startDeg);
  const e = normalizeAngleDeg(endDeg);
  if (s <= e) return a >= s && a <= e;
  return a >= s || a <= e;
}

export function getPolylineVertices(entity: Entity): { vertices: Point2D[] | undefined; closed: boolean } {
  if (isPolylineEntity(entity)) return { vertices: entity.vertices, closed: entity.closed || false };
  if (isLWPolylineEntity(entity)) return { vertices: entity.vertices, closed: entity.closed || false };
  return { vertices: undefined, closed: false };
}

function pointAt(pl: ParametricLine, t: number): Point2D {
  return { x: pl.basePoint.x + t * pl.direction.x, y: pl.basePoint.y + t * pl.direction.y };
}

/** Parameter values where the line meets the circle of `center`/`radius`. Empty when degenerate or disjoint. */
function circleTValues(pl: ParametricLine, center: Point2D, radius: number): number[] {
  const dir = pl.direction;
  const dx = pl.basePoint.x - center.x;
  const dy = pl.basePoint.y - center.y;
  const A = dir.x * dir.x + dir.y * dir.y;
  if (A < XLINE_EPSILON) return [];
  const B = 2 * (dx * dir.x + dy * dir.y);
  const C = dx * dx + dy * dy - radius * radius;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  if (disc < XLINE_EPSILON) return [-B / (2 * A)];
  const sqrtDisc = Math.sqrt(disc);
  return [(-B - sqrtDisc) / (2 * A), (-B + sqrtDisc) / (2 * A)];
}

// ─── Solvers ──────────────────────────────────────────────────────────────────

export function parametricSegmentsIntersection(
  pl: ParametricLine,
  segments: readonly Segment[],
  accept: TAccept,
  type: IntersectionResult['type'],
): IntersectionResult[] {
  const results: IntersectionResult[] = [];
  for (const seg of segments) {
    const segDir: Point2D = { x: seg.end.x - seg.start.x, y: seg.end.y - seg.start.y };
    const denom = cross2D(pl.direction, segDir);
    if (Math.abs(denom) < XLINE_EPSILON) continue;
    const diff: Point2D = { x: seg.start.x - pl.basePoint.x, y: seg.start.y - pl.basePoint.y };
    const t = cross2D(diff, segDir) / denom;
    const s = cross2D(diff, pl.direction) / denom;
    if (!accept(t)) continue;
    if (s < -XLINE_EPSILON || s > 1 + XLINE_EPSILON) continue;
    results.push({ point: { x: seg.start.x + s * segDir.x, y: seg.start.y + s * segDir.y }, type });
  }
  return results;
}

export function parametricLineIntersection(
  pl: ParametricLine,
  line: Segment,
  accept: TAccept,
  type: IntersectionResult['type'],
): IntersectionResult[] {
  return parametricSegmentsIntersection(pl, [line], accept, type);
}

export function parametricPolylineIntersection(
  pl: ParametricLine,
  polyline: Entity,
  accept: TAccept,
  type: IntersectionResult['type'],
): IntersectionResult[] {
  const { vertices, closed } = getPolylineVertices(polyline);
  if (!vertices || vertices.length < 2) return [];
  return parametricSegmentsIntersection(pl, getPolylineSegments(vertices, closed), accept, type);
}

export function parametricRectangleIntersection(
  pl: ParametricLine,
  rectangle: Entity,
  accept: TAccept,
  type: IntersectionResult['type'],
): IntersectionResult[] {
  if (!isRectangleEntity(rectangle)) return [];
  return parametricSegmentsIntersection(pl, GeometricCalculations.getRectangleLines(rectangle), accept, type);
}

export function parametricCircleIntersection(
  pl: ParametricLine,
  circle: CircleLike,
  accept: TAccept,
  type: IntersectionResult['type'],
): IntersectionResult[] {
  return circleTValues(pl, circle.center, circle.radius)
    .filter(accept)
    .map((t) => ({ point: pointAt(pl, t), type }));
}

export function parametricArcIntersection(
  pl: ParametricLine,
  arc: ArcLike,
  accept: TAccept,
  type: IntersectionResult['type'],
): IntersectionResult[] {
  const results: IntersectionResult[] = [];
  for (const t of circleTValues(pl, arc.center, arc.radius)) {
    if (!accept(t)) continue;
    const p = pointAt(pl, t);
    const angleDeg = normalizeAngleDeg(Math.atan2(p.y - arc.center.y, p.x - arc.center.x) * 180 / Math.PI);
    if (isAngleInRange(angleDeg, arc.startAngle, arc.endAngle)) results.push({ point: p, type });
  }
  return results;
}

export function parametricEllipseIntersection(
  pl: ParametricLine,
  ellipse: EllipseLike,
  accept: TAccept,
  type: IntersectionResult['type'],
): IntersectionResult[] {
  const a = ellipse.majorAxis;
  const b = ellipse.minorAxis;
  if (a < XLINE_EPSILON || b < XLINE_EPSILON) return [];

  const rotRad = ((ellipse.rotation ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const dir = pl.direction;
  const dx = pl.basePoint.x - ellipse.center.x;
  const dy = pl.basePoint.y - ellipse.center.y;

  // Rotate into the ellipse-local U/V frame, where the conic is axis-aligned.
  const pU = dx * cosR + dy * sinR;
  const pV = dx * (-sinR) + dy * cosR;
  const dU = dir.x * cosR + dir.y * sinR;
  const dV = dir.x * (-sinR) + dir.y * cosR;

  const A = dU * dU / (a * a) + dV * dV / (b * b);
  if (A < XLINE_EPSILON) return [];
  const B = 2 * (pU * dU / (a * a) + pV * dV / (b * b));
  const C = pU * pU / (a * a) + pV * pV / (b * b) - 1;
  const disc = B * B - 4 * A * C;
  if (disc < -XLINE_EPSILON) return [];

  const tValues = disc < XLINE_EPSILON
    ? [-B / (2 * A)]
    : [(-B - Math.sqrt(Math.max(0, disc))) / (2 * A), (-B + Math.sqrt(Math.max(0, disc))) / (2 * A)];

  const TWO_PI = 2 * Math.PI;
  const results: IntersectionResult[] = [];

  for (const t of tValues) {
    if (!accept(t)) continue;
    const pt = pointAt(pl, t);

    if (ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
      const lU = (pt.x - ellipse.center.x) * cosR + (pt.y - ellipse.center.y) * sinR;
      const lV = (pt.x - ellipse.center.x) * (-sinR) + (pt.y - ellipse.center.y) * cosR;
      const theta = (Math.atan2(lV / b, lU / a) + TWO_PI) % TWO_PI;
      const s = ((ellipse.startParam % TWO_PI) + TWO_PI) % TWO_PI;
      const e = ((ellipse.endParam % TWO_PI) + TWO_PI) % TWO_PI;
      const inRange = s <= e
        ? theta >= s - XLINE_EPSILON && theta <= e + XLINE_EPSILON
        : theta >= s - XLINE_EPSILON || theta <= e + XLINE_EPSILON;
      if (!inRange) continue;
    }

    results.push({ point: pt, type });
  }
  return results;
}
