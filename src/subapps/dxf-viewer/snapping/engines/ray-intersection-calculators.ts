/**
 * Ray Intersection Calculation Functions
 *
 * Phase 6.5.a + 6.5.b (ADR-359 §7) — Ray×primitive and Ray×self/complex
 * intersection calculators. Extracted from `intersection-calculators.ts`
 * to keep that file under the 500-line Google SRP limit.
 *
 * A Ray is an unbounded parametric line accepting only forward parameters, so
 * the primitive math lives in `parametric-line-intersection-core` and is shared
 * with XLINE — `acceptRayT` is the whole difference.
 *
 * @module snapping/engines/ray-intersection-calculators
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../extended-types';
import type { IntersectionResult } from '../shared/GeometricCalculations';
import type { LineEntity, CircleEntity, ArcEntity, XLineEntity, EllipseEntity, RayEntity } from '../../types/entities';
import {
  XLINE_EPSILON,
  cross2D,
  acceptRayT,
  parametricLineIntersection,
  parametricPolylineIntersection,
  parametricRectangleIntersection,
  parametricCircleIntersection,
  parametricArcIntersection,
  parametricEllipseIntersection,
} from './parametric-line-intersection-core';

// ─── Ray Phase 6.5.a (ADR-359) ───────────────────────────────────────────────

export function rayLineIntersection(ray: RayEntity, line: LineEntity): IntersectionResult[] {
  return parametricLineIntersection(ray, line, acceptRayT, 'Ray-Line');
}

export function rayCircleIntersection(ray: RayEntity, circle: CircleEntity): IntersectionResult[] {
  return parametricCircleIntersection(ray, circle, acceptRayT, 'Ray-Circle');
}

export function rayArcIntersection(ray: RayEntity, arc: ArcEntity): IntersectionResult[] {
  return parametricArcIntersection(ray, arc, acceptRayT, 'Ray-Arc');
}

// ─── Ray Phase 6.5.b (ADR-359) ───────────────────────────────────────────────

// Ray×Ray and Ray×XLine stay explicit: unlike the primitive solvers they clamp
// the parameter on BOTH lines (Ray-Ray) or only on the ray (Ray-XLine), so they
// don't reduce to a single `accept` predicate.

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
  return parametricPolylineIntersection(ray, polyline, acceptRayT, 'Ray-Polyline');
}

export function rayEllipseIntersection(ray: RayEntity, ellipse: EllipseEntity): IntersectionResult[] {
  return parametricEllipseIntersection(ray, ellipse, acceptRayT, 'Ray-Ellipse');
}

export function rayRectangleIntersection(ray: RayEntity, rectangle: Entity): IntersectionResult[] {
  return parametricRectangleIntersection(ray, rectangle, acceptRayT, 'Ray-Rectangle');
}
