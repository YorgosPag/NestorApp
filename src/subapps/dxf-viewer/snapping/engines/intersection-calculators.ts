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
import type { LineEntity, CircleEntity, ArcEntity, XLineEntity, EllipseEntity } from '../../types/entities';
import {
  isLineEntity,
  isCircleEntity,
  isArcEntity,
  isRectangleEntity
} from '../../types/entities';
import {
  XLINE_EPSILON,
  cross2D,
  isAngleInRange,
  getPolylineVertices,
  acceptXlineT,
  parametricLineIntersection,
  parametricPolylineIntersection,
  parametricRectangleIntersection,
  parametricCircleIntersection,
  parametricArcIntersection,
  parametricEllipseIntersection,
} from './parametric-line-intersection-core';

// This module is the barrel for the whole intersection surface — consumers (and tests)
// import these from here, so the core's primitives stay reachable under their old names.
export { XLINE_EPSILON, cross2D, isAngleInRange, getPolylineVertices };

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
// XLine is unbounded in both directions; `acceptXlineT` is its only difference
// from Ray. The math itself lives in parametric-line-intersection-core.

export function xlineLineIntersection(xline: XLineEntity, line: LineEntity): IntersectionResult[] {
  return parametricLineIntersection(xline, line, acceptXlineT, 'XLine-Line');
}

export function xlineXlineIntersection(a: XLineEntity, b: XLineEntity): IntersectionResult[] {
  const denom = cross2D(a.direction, b.direction);
  if (Math.abs(denom) < XLINE_EPSILON) return [];
  const diff: Point2D = { x: b.basePoint.x - a.basePoint.x, y: b.basePoint.y - a.basePoint.y };
  const t = cross2D(diff, b.direction) / denom;
  if (!acceptXlineT(t)) return [];
  return [{ point: { x: a.basePoint.x + t * a.direction.x, y: a.basePoint.y + t * a.direction.y }, type: 'XLine-XLine' }];
}

export function xlineCircleIntersection(xline: XLineEntity, circle: CircleEntity): IntersectionResult[] {
  return parametricCircleIntersection(xline, circle, acceptXlineT, 'XLine-Circle');
}

export function xlineArcIntersection(xline: XLineEntity, arc: ArcEntity): IntersectionResult[] {
  return parametricArcIntersection(xline, arc, acceptXlineT, 'XLine-Arc');
}

// ─── XLine Phase 6.b — POLYLINE / ELLIPSE / RECTANGLE (ADR-359) ──────────────

export function xlinePolylineIntersection(xline: XLineEntity, polyline: Entity): IntersectionResult[] {
  return parametricPolylineIntersection(xline, polyline, acceptXlineT, 'XLine-Polyline');
}

export function xlineEllipseIntersection(xline: XLineEntity, ellipse: EllipseEntity): IntersectionResult[] {
  return parametricEllipseIntersection(xline, ellipse, acceptXlineT, 'XLine-Ellipse');
}

export function xlineRectangleIntersection(xline: XLineEntity, rectangle: Entity): IntersectionResult[] {
  return parametricRectangleIntersection(xline, rectangle, acceptXlineT, 'XLine-Rectangle');
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
