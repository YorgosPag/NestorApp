/**
 * Ray Intersection Calculation Functions
 *
 * Phase 6.5.a + 6.5.b (ADR-359 §7) — Ray×primitive and Ray×self/complex
 * intersection calculators. Extracted from `intersection-calculators.ts`
 * to keep that file under the 500-line Google SRP limit.
 *
 * @module snapping/engines/ray-intersection-calculators
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../extended-types';
import type { IntersectionResult } from '../shared/GeometricCalculations';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import type { LineEntity, CircleEntity, ArcEntity, XLineEntity, EllipseEntity, RayEntity } from '../../types/entities';
import { isRectangleEntity } from '../../types/entities';
import {
  XLINE_EPSILON,
  cross2D,
  isAngleInRange,
  getPolylineVertices,
} from './intersection-calculators';

/**
 * Ray × poly-segments intersection SSoT (ADR-583 / N.18). Both the polyline and
 * the rectangle calculators reduce to "a ray against a list of straight segments";
 * the per-segment math lived duplicated in each. `type` tags the emitted results.
 */
function raySegmentsIntersection(
  ray: RayEntity,
  segments: readonly { start: Point2D; end: Point2D }[],
  type: IntersectionResult['type'],
): IntersectionResult[] {
  const results: IntersectionResult[] = [];
  for (const seg of segments) {
    const segDir: Point2D = { x: seg.end.x - seg.start.x, y: seg.end.y - seg.start.y };
    const denom = cross2D(ray.direction, segDir);
    if (Math.abs(denom) < XLINE_EPSILON) continue;
    const diff: Point2D = { x: seg.start.x - ray.basePoint.x, y: seg.start.y - ray.basePoint.y };
    const tRay = cross2D(diff, segDir) / denom;
    const sSeg = cross2D(diff, ray.direction) / denom;
    if (tRay < -XLINE_EPSILON) continue;
    if (sSeg < -XLINE_EPSILON || sSeg > 1 + XLINE_EPSILON) continue;
    results.push({ point: { x: seg.start.x + sSeg * segDir.x, y: seg.start.y + sSeg * segDir.y }, type });
  }
  return results;
}

// ─── Ray Phase 6.5.a (ADR-359) ───────────────────────────────────────────────

export function rayLineIntersection(ray: RayEntity, line: LineEntity): IntersectionResult[] {
  const dirL: Point2D = { x: line.end.x - line.start.x, y: line.end.y - line.start.y };
  const denom = cross2D(ray.direction, dirL);
  if (Math.abs(denom) < XLINE_EPSILON) return [];
  const diff: Point2D = { x: line.start.x - ray.basePoint.x, y: line.start.y - ray.basePoint.y };
  const t = cross2D(diff, dirL) / denom;
  const s = cross2D(diff, ray.direction) / denom;
  if (t < -XLINE_EPSILON) return [];
  if (s < -XLINE_EPSILON || s > 1 + XLINE_EPSILON) return [];
  return [{ point: { x: line.start.x + s * dirL.x, y: line.start.y + s * dirL.y }, type: 'Ray-Line' }];
}

export function rayCircleIntersection(ray: RayEntity, circle: CircleEntity): IntersectionResult[] {
  const dir = ray.direction;
  const dx = ray.basePoint.x - circle.center.x;
  const dy = ray.basePoint.y - circle.center.y;
  const A = dir.x * dir.x + dir.y * dir.y;
  if (A < XLINE_EPSILON) return [];
  const B = 2 * (dx * dir.x + dy * dir.y);
  const C = dx * dx + dy * dy - circle.radius * circle.radius;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const results: IntersectionResult[] = [];
  if (disc < XLINE_EPSILON) {
    const t = -B / (2 * A);
    if (t >= -XLINE_EPSILON)
      results.push({ point: { x: ray.basePoint.x + t * dir.x, y: ray.basePoint.y + t * dir.y }, type: 'Ray-Circle' });
  } else {
    const sqrtDisc = Math.sqrt(disc);
    for (const t of [(-B - sqrtDisc) / (2 * A), (-B + sqrtDisc) / (2 * A)]) {
      if (t >= -XLINE_EPSILON)
        results.push({ point: { x: ray.basePoint.x + t * dir.x, y: ray.basePoint.y + t * dir.y }, type: 'Ray-Circle' });
    }
  }
  return results;
}

export function rayArcIntersection(ray: RayEntity, arc: ArcEntity): IntersectionResult[] {
  const dir = ray.direction;
  const dx = ray.basePoint.x - arc.center.x;
  const dy = ray.basePoint.y - arc.center.y;
  const A = dir.x * dir.x + dir.y * dir.y;
  if (A < XLINE_EPSILON) return [];
  const B = 2 * (dx * dir.x + dy * dir.y);
  const C = dx * dx + dy * dy - arc.radius * arc.radius;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const tValues: number[] = disc < XLINE_EPSILON
    ? [-B / (2 * A)]
    : [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)];
  const results: IntersectionResult[] = [];
  for (const t of tValues) {
    if (t < -XLINE_EPSILON) continue;
    const p: Point2D = { x: ray.basePoint.x + t * dir.x, y: ray.basePoint.y + t * dir.y };
    const angleDeg = normalizeAngleDeg(Math.atan2(p.y - arc.center.y, p.x - arc.center.x) * 180 / Math.PI);
    if (isAngleInRange(angleDeg, arc.startAngle, arc.endAngle))
      results.push({ point: p, type: 'Ray-Arc' });
  }
  return results;
}

// ─── Ray Phase 6.5.b (ADR-359) ───────────────────────────────────────────────

export function rayRayIntersection(ray1: RayEntity, ray2: RayEntity): IntersectionResult[] {
  const denom = cross2D(ray1.direction, ray2.direction);
  if (Math.abs(denom) < XLINE_EPSILON) return [];
  const diff: Point2D = { x: ray2.basePoint.x - ray1.basePoint.x, y: ray2.basePoint.y - ray1.basePoint.y };
  const t1 = cross2D(diff, ray2.direction) / denom;
  const t2 = cross2D(diff, ray1.direction) / denom;
  if (t1 < -XLINE_EPSILON || t2 < -XLINE_EPSILON) return [];
  return [{ point: { x: ray1.basePoint.x + t1 * ray1.direction.x, y: ray1.basePoint.y + t1 * ray1.direction.y }, type: 'Ray-Ray' }];
}

export function rayXlineIntersection(ray: RayEntity, xline: XLineEntity): IntersectionResult[] {
  const denom = cross2D(ray.direction, xline.direction);
  if (Math.abs(denom) < XLINE_EPSILON) return [];
  const diff: Point2D = { x: xline.basePoint.x - ray.basePoint.x, y: xline.basePoint.y - ray.basePoint.y };
  const tRay = cross2D(diff, xline.direction) / denom;
  if (tRay < -XLINE_EPSILON) return [];
  return [{ point: { x: ray.basePoint.x + tRay * ray.direction.x, y: ray.basePoint.y + tRay * ray.direction.y }, type: 'Ray-XLine' }];
}

export function rayPolylineIntersection(ray: RayEntity, polyline: Entity): IntersectionResult[] {
  const { vertices, closed: isClosed } = getPolylineVertices(polyline);
  if (!vertices || vertices.length < 2) return [];
  return raySegmentsIntersection(ray, getPolylineSegments(vertices, isClosed), 'Ray-Polyline');
}

export function rayEllipseIntersection(ray: RayEntity, ellipse: EllipseEntity): IntersectionResult[] {
  const a = ellipse.majorAxis;
  const b = ellipse.minorAxis;
  if (a < XLINE_EPSILON || b < XLINE_EPSILON) return [];

  const rotRad = ((ellipse.rotation ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const dir = ray.direction;
  const dx = ray.basePoint.x - ellipse.center.x;
  const dy = ray.basePoint.y - ellipse.center.y;

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
    if (t < -XLINE_EPSILON) continue;
    const pt: Point2D = { x: ray.basePoint.x + t * dir.x, y: ray.basePoint.y + t * dir.y };

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

    results.push({ point: pt, type: 'Ray-Ellipse' });
  }
  return results;
}

export function rayRectangleIntersection(ray: RayEntity, rectangle: Entity): IntersectionResult[] {
  if (!isRectangleEntity(rectangle)) return [];
  return raySegmentsIntersection(ray, GeometricCalculations.getRectangleLines(rectangle), 'Ray-Rectangle');
}
