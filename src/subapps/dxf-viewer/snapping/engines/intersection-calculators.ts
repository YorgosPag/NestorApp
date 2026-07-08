/**
 * Intersection Calculation Functions
 *
 * Type-specific geometric intersection calculations for the IntersectionSnapEngine.
 * Extracted per ADR-065 (file size compliance).
 *
 * @module snapping/engines/intersection-calculators
 */

import type { Point2D } from '../../rendering/types/Types';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import type { Entity } from '../extended-types';
import type { IntersectionResult } from '../shared/GeometricCalculations';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { LineEntity, CircleEntity, ArcEntity, XLineEntity, EllipseEntity } from '../../types/entities';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isCircleEntity,
  isArcEntity,
  isRectangleEntity
} from '../../types/entities';

// ─── Helper: Extract vertices from polyline/lwpolyline ────────────────────

export function getPolylineVertices(entity: Entity): { vertices: Point2D[] | undefined; closed: boolean } {
  if (isPolylineEntity(entity)) return { vertices: entity.vertices, closed: entity.closed || false };
  if (isLWPolylineEntity(entity)) return { vertices: entity.vertices, closed: entity.closed || false };
  return { vertices: undefined, closed: false };
}

function getCircleData(entity: Entity): (CircleEntity | ArcEntity) | null {
  if (isCircleEntity(entity) || isArcEntity(entity)) return entity as CircleEntity | ArcEntity;
  return null;
}

// ─── Intersection Calculators ─────────────────────────────────────────────

export function lineLineIntersection(line1: Entity, line2: Entity): IntersectionResult[] {
  if (!isLineEntity(line1) || !isLineEntity(line2)) return [];
  const intersection = GeometricCalculations.getLineIntersection(
    line1.start, line1.end, line2.start, line2.end
  );
  return intersection ? [{ point: intersection, type: 'Line-Line' }] : [];
}

export function lineCircleIntersection(line: Entity, circle: Entity): IntersectionResult[] {
  if (!isLineEntity(line)) return [];
  const circleData = getCircleData(circle);
  if (!circleData) return [];
  const intersections = GeometricCalculations.getLineCircleIntersections(
    line.start, line.end, circleData.center, circleData.radius
  );
  return intersections.map(point => ({ point, type: 'Line-Circle' }));
}

export function circleCircleIntersection(circle1: Entity, circle2: Entity): IntersectionResult[] {
  const c1 = getCircleData(circle1);
  const c2 = getCircleData(circle2);
  if (!c1 || !c2) return [];
  const intersections = GeometricCalculations.getCircleIntersections(
    c1.center, c1.radius, c2.center, c2.radius
  );
  return intersections.map(point => ({ point, type: 'Circle-Circle' }));
}

export function polylineLineIntersection(polyline: Entity, line: Entity): IntersectionResult[] {
  if (!isLineEntity(line)) return [];
  const { vertices, closed: isClosed } = getPolylineVertices(polyline);
  if (!vertices || vertices.length < 2) return [];

  const intersections: IntersectionResult[] = [];

  for (let i = 1; i < vertices.length; i++) {
    const intersection = GeometricCalculations.getLineIntersection(
      vertices[i - 1], vertices[i], line.start, line.end
    );
    if (intersection) {
      intersections.push({ point: intersection, type: 'Polyline-Line' });
    }
  }

  if (isClosed && vertices.length > 2) {
    const intersection = GeometricCalculations.getLineIntersection(
      vertices[vertices.length - 1], vertices[0], line.start, line.end
    );
    if (intersection) {
      intersections.push({ point: intersection, type: 'Polyline-Line' });
    }
  }

  return intersections;
}

export function polylinePolylineIntersection(poly1: Entity, poly2: Entity): IntersectionResult[] {
  const p1 = getPolylineVertices(poly1);
  const p2 = getPolylineVertices(poly2);
  if (!p1.vertices || !p2.vertices) return [];

  const intersections: IntersectionResult[] = [];
  const segments1 = getPolylineSegments(p1.vertices, p1.closed);
  const segments2 = getPolylineSegments(p2.vertices, p2.closed);

  for (const seg1 of segments1) {
    for (const seg2 of segments2) {
      const intersection = GeometricCalculations.getLineIntersection(
        seg1.start, seg1.end, seg2.start, seg2.end
      );
      if (intersection) {
        intersections.push({ point: intersection, type: 'Polyline-Polyline' });
      }
    }
  }

  return intersections;
}

export function polylineCircleIntersection(polyline: Entity, circle: Entity): IntersectionResult[] {
  const { vertices, closed: isClosed } = getPolylineVertices(polyline);
  if (!vertices) return [];
  const circleData = getCircleData(circle);
  if (!circleData) return [];

  const intersections: IntersectionResult[] = [];
  const segments = getPolylineSegments(vertices, isClosed);

  for (const segment of segments) {
    const lineIntersections = GeometricCalculations.getLineCircleIntersections(
      segment.start, segment.end, circleData.center, circleData.radius
    );
    for (const intersection of lineIntersections) {
      intersections.push({ point: intersection, type: 'Polyline-Circle' });
    }
  }

  return intersections;
}

export function rectangleLineIntersection(rectangle: Entity, line: Entity): IntersectionResult[] {
  if (!isLineEntity(line) || !isRectangleEntity(rectangle)) return [];
  const rectLines = GeometricCalculations.getRectangleLines(rectangle);
  const intersections: IntersectionResult[] = [];

  for (const rectLine of rectLines) {
    const intersection = GeometricCalculations.getLineIntersection(
      line.start, line.end, rectLine.start, rectLine.end
    );
    if (intersection) {
      intersections.push({ point: intersection, type: 'Rectangle-Line' });
    }
  }

  return intersections;
}

export function rectangleCircleIntersection(rectangle: Entity, circle: Entity): IntersectionResult[] {
  if (!isRectangleEntity(rectangle)) return [];
  const circleData = getCircleData(circle);
  if (!circleData) return [];
  const rectLines = GeometricCalculations.getRectangleLines(rectangle);
  const intersections: IntersectionResult[] = [];

  for (const rectLine of rectLines) {
    const lineIntersections = GeometricCalculations.getLineCircleIntersections(
      rectLine.start, rectLine.end, circleData.center, circleData.radius
    );
    for (const intersection of lineIntersections) {
      intersections.push({ point: intersection, type: 'Rectangle-Circle' });
    }
  }

  return intersections;
}

export function rectanglePolylineIntersection(rectangle: Entity, polyline: Entity): IntersectionResult[] {
  if (!isRectangleEntity(rectangle)) return [];
  const { vertices } = getPolylineVertices(polyline);
  if (!vertices || vertices.length < 2) return [];

  const rectLines = GeometricCalculations.getRectangleLines(rectangle);
  const intersections: IntersectionResult[] = [];

  for (const rectLine of rectLines) {
    for (let i = 1; i < vertices.length; i++) {
      const intersection = GeometricCalculations.getLineIntersection(
        rectLine.start, rectLine.end, vertices[i - 1], vertices[i]
      );
      if (intersection) {
        intersections.push({ point: intersection, type: 'Rectangle-Polyline' });
      }
    }
  }

  return intersections;
}

export function rectangleRectangleIntersection(rect1: Entity, rect2: Entity): IntersectionResult[] {
  if (!isRectangleEntity(rect1) || !isRectangleEntity(rect2)) return [];
  const rect1Lines = GeometricCalculations.getRectangleLines(rect1);
  const rect2Lines = GeometricCalculations.getRectangleLines(rect2);
  const intersections: IntersectionResult[] = [];

  for (const line1 of rect1Lines) {
    for (const line2 of rect2Lines) {
      const intersection = GeometricCalculations.getLineIntersection(
        line1.start, line1.end, line2.start, line2.end
      );
      if (intersection) {
        intersections.push({ point: intersection, type: 'Rectangle-Rectangle' });
      }
    }
  }

  return intersections;
}

// ─── XLine Intersection Calculators (Phase 6.a — ADR-359) ────────────────────

export const XLINE_EPSILON = 1e-10;
const XLINE_MAX_T = 1e8;

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

export function xlineLineIntersection(xline: XLineEntity, line: LineEntity): IntersectionResult[] {
  const dirXl = xline.direction;
  const dirL: Point2D = { x: line.end.x - line.start.x, y: line.end.y - line.start.y };
  const denom = cross2D(dirXl, dirL);
  if (Math.abs(denom) < XLINE_EPSILON) return [];
  const diff: Point2D = { x: line.start.x - xline.basePoint.x, y: line.start.y - xline.basePoint.y };
  const tXl = cross2D(diff, dirL) / denom;
  const sLine = cross2D(diff, dirXl) / denom;
  if (Math.abs(tXl) > XLINE_MAX_T) return [];
  if (sLine < -XLINE_EPSILON || sLine > 1 + XLINE_EPSILON) return [];
  return [{ point: { x: line.start.x + sLine * dirL.x, y: line.start.y + sLine * dirL.y }, type: 'XLine-Line' }];
}

export function xlineXlineIntersection(a: XLineEntity, b: XLineEntity): IntersectionResult[] {
  const denom = cross2D(a.direction, b.direction);
  if (Math.abs(denom) < XLINE_EPSILON) return [];
  const diff: Point2D = { x: b.basePoint.x - a.basePoint.x, y: b.basePoint.y - a.basePoint.y };
  const t = cross2D(diff, b.direction) / denom;
  if (Math.abs(t) > XLINE_MAX_T) return [];
  return [{ point: { x: a.basePoint.x + t * a.direction.x, y: a.basePoint.y + t * a.direction.y }, type: 'XLine-XLine' }];
}

export function xlineCircleIntersection(xline: XLineEntity, circle: CircleEntity): IntersectionResult[] {
  const dir = xline.direction;
  const dx = xline.basePoint.x - circle.center.x;
  const dy = xline.basePoint.y - circle.center.y;
  const A = dir.x * dir.x + dir.y * dir.y;
  if (A < XLINE_EPSILON) return [];
  const B = 2 * (dx * dir.x + dy * dir.y);
  const C = dx * dx + dy * dy - circle.radius * circle.radius;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const results: IntersectionResult[] = [];
  if (disc < XLINE_EPSILON) {
    const t = -B / (2 * A);
    if (Math.abs(t) <= XLINE_MAX_T)
      results.push({ point: { x: xline.basePoint.x + t * dir.x, y: xline.basePoint.y + t * dir.y }, type: 'XLine-Circle' });
  } else {
    const sqrtDisc = Math.sqrt(disc);
    for (const t of [(-B - sqrtDisc) / (2 * A), (-B + sqrtDisc) / (2 * A)]) {
      if (Math.abs(t) <= XLINE_MAX_T)
        results.push({ point: { x: xline.basePoint.x + t * dir.x, y: xline.basePoint.y + t * dir.y }, type: 'XLine-Circle' });
    }
  }
  return results;
}

export function xlineArcIntersection(xline: XLineEntity, arc: ArcEntity): IntersectionResult[] {
  const dir = xline.direction;
  const dx = xline.basePoint.x - arc.center.x;
  const dy = xline.basePoint.y - arc.center.y;
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
    if (Math.abs(t) > XLINE_MAX_T) continue;
    const p: Point2D = { x: xline.basePoint.x + t * dir.x, y: xline.basePoint.y + t * dir.y };
    const angleDeg = normalizeAngleDeg(Math.atan2(p.y - arc.center.y, p.x - arc.center.x) * 180 / Math.PI);
    if (isAngleInRange(angleDeg, arc.startAngle, arc.endAngle))
      results.push({ point: p, type: 'XLine-Arc' });
  }
  return results;
}

// ─── XLine Phase 6.b — POLYLINE / ELLIPSE / RECTANGLE (ADR-359) ──────────────

function xlineSegmentPoint(xline: XLineEntity, segStart: Point2D, segEnd: Point2D): Point2D | null {
  const dir = xline.direction;
  const segDir: Point2D = { x: segEnd.x - segStart.x, y: segEnd.y - segStart.y };
  const denom = cross2D(dir, segDir);
  if (Math.abs(denom) < XLINE_EPSILON) return null;
  const diff: Point2D = { x: segStart.x - xline.basePoint.x, y: segStart.y - xline.basePoint.y };
  const tXl = cross2D(diff, segDir) / denom;
  const sLine = cross2D(diff, dir) / denom;
  if (Math.abs(tXl) > XLINE_MAX_T) return null;
  if (sLine < -XLINE_EPSILON || sLine > 1 + XLINE_EPSILON) return null;
  return { x: segStart.x + sLine * segDir.x, y: segStart.y + sLine * segDir.y };
}

export function xlinePolylineIntersection(xline: XLineEntity, polyline: Entity): IntersectionResult[] {
  const { vertices, closed: isClosed } = getPolylineVertices(polyline);
  if (!vertices || vertices.length < 2) return [];
  const results: IntersectionResult[] = [];
  const segments = getPolylineSegments(vertices, isClosed);
  for (const seg of segments) {
    const pt = xlineSegmentPoint(xline, seg.start, seg.end);
    if (pt) results.push({ point: pt, type: 'XLine-Polyline' });
  }
  return results;
}

export function xlineEllipseIntersection(xline: XLineEntity, ellipse: EllipseEntity): IntersectionResult[] {
  const a = ellipse.majorAxis;
  const b = ellipse.minorAxis;
  if (a < XLINE_EPSILON || b < XLINE_EPSILON) return [];

  const rotRad = ((ellipse.rotation ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const dir = xline.direction;
  const dx = xline.basePoint.x - ellipse.center.x;
  const dy = xline.basePoint.y - ellipse.center.y;

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
    if (Math.abs(t) > XLINE_MAX_T) continue;
    const pt: Point2D = { x: xline.basePoint.x + t * dir.x, y: xline.basePoint.y + t * dir.y };

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

    results.push({ point: pt, type: 'XLine-Ellipse' });
  }
  return results;
}

export function xlineRectangleIntersection(xline: XLineEntity, rectangle: Entity): IntersectionResult[] {
  if (!isRectangleEntity(rectangle)) return [];
  const rectLines = GeometricCalculations.getRectangleLines(rectangle);
  const results: IntersectionResult[] = [];
  for (const seg of rectLines) {
    const pt = xlineSegmentPoint(xline, seg.start, seg.end);
    if (pt) results.push({ point: pt, type: 'XLine-Rectangle' });
  }
  return results;
}

// ─── Ray Phase 6.5.a + 6.5.b (ADR-359) — moved to ray-intersection-calculators.ts ───
export {
  rayLineIntersection,
  rayCircleIntersection,
  rayArcIntersection,
  rayRayIntersection,
  rayXlineIntersection,
  rayPolylineIntersection,
  rayEllipseIntersection,
  rayRectangleIntersection,
} from './ray-intersection-calculators';
