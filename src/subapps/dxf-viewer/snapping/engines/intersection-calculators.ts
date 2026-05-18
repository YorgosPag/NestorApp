/**
 * Intersection Calculation Functions
 *
 * Type-specific geometric intersection calculations for the IntersectionSnapEngine.
 * Extracted per ADR-065 (file size compliance).
 *
 * @module snapping/engines/intersection-calculators
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../extended-types';
import type { IntersectionResult } from '../shared/GeometricCalculations';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
import type { LineEntity, CircleEntity, ArcEntity, XLineEntity } from '../../types/entities';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isCircleEntity,
  isArcEntity,
  isRectangleEntity
} from '../../types/entities';

// ─── Helper: Extract vertices from polyline/lwpolyline ────────────────────

function getPolylineVertices(entity: Entity): { vertices: Point2D[] | undefined; closed: boolean } {
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

const XLINE_EPSILON = 1e-10;
const XLINE_MAX_T = 1e8;

function cross2D(a: Point2D, b: Point2D): number {
  return a.x * b.y - a.y * b.x;
}

function isAngleInRange(angleDeg: number, startDeg: number, endDeg: number): boolean {
  const a = ((angleDeg % 360) + 360) % 360;
  const s = ((startDeg % 360) + 360) % 360;
  const e = ((endDeg % 360) + 360) % 360;
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
    const angleDeg = (Math.atan2(p.y - arc.center.y, p.x - arc.center.x) * 180 / Math.PI + 360) % 360;
    if (isAngleInRange(angleDeg, arc.startAngle, arc.endAngle))
      results.push({ point: p, type: 'XLine-Arc' });
  }
  return results;
}
