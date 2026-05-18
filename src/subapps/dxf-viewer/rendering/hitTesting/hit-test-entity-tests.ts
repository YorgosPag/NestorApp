/**
 * Entity-Specific Hit Tests — ADR-065 SRP split
 * Per-entity-type precise hit testing functions.
 * Extracted from HitTester.ts.
 */

import type { Point2D } from '../types/Types';
import type { Entity, DimensionEntity } from '../../types/entities';
import type { HitTestResult, SnapResult } from './hit-tester-types';
import { pointToLineDistance, clamp, degToRad } from '../entities/shared/geometry-utils';
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { calculateDistance } from '../entities/shared/geometry-rendering-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { pointToInfiniteLineDistance } from '../utils/point-to-line-distance';
import { pointToRayDistance } from '../utils/point-to-line-distance';

/** Dispatch hit test to the correct entity-type handler */
export function performDetailedHitTest(
  entity: Entity, point: Point2D, tolerance: number
): Partial<HitTestResult> | null {
  switch (entity.type) {
    case 'line': return hitTestLine(entity, point, tolerance);
    case 'circle': return hitTestCircle(entity, point, tolerance);
    case 'polyline':
    case 'lwpolyline': return hitTestPolyline(entity, point, tolerance);
    case 'rectangle':
    case 'rect': return hitTestRectangle(entity, point, tolerance);
    case 'text':
    case 'mtext': return hitTestText(entity, point, tolerance);
    case 'arc': return hitTestArc(entity, point, tolerance);
    case 'angle-measurement': return hitTestAngleMeasurement(entity, point, tolerance);
    case 'dimension': return hitTestDimension(entity as DimensionEntity, point, tolerance);
    // ADR-359 Phase 11 — precise hit-test for construction lines.
    case 'xline': return hitTestXLine(entity, point, tolerance);
    case 'ray': return hitTestRay(entity, point, tolerance);
    default: return { hitType: 'entity', hitPoint: point };
  }
}

// ===== LINE =====

function hitTestLine(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('start' in entity) || !('end' in entity)) return null;
  const lineEntity = entity as { start: Point2D; end: Point2D };
  const distance = pointToLineDistance(point, lineEntity.start, lineEntity.end);

  if (distance <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, lineEntity.start, lineEntity.end) };
  }
  return null;
}

// ===== CIRCLE =====

function hitTestCircle(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('center' in entity) || !('radius' in entity)) return null;
  const circleEntity = entity as { center: Point2D; radius: number };
  const distanceFromCenter = calculateDistance(point, circleEntity.center);
  const distanceFromCircumference = Math.abs(distanceFromCenter - circleEntity.radius);

  if (distanceFromCircumference <= tolerance) {
    return { hitType: 'entity', hitPoint: point };
  }
  return null;
}

// ===== ARC =====

function hitTestArc(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('center' in entity) || !('radius' in entity) || !('startAngle' in entity) || !('endAngle' in entity)) {
    return null;
  }
  const arcEntity = entity as { center: Point2D; radius: number; startAngle: number; endAngle: number };
  const distance = pointToArcDistance(point, arcEntity);
  if (distance <= tolerance) {
    return { hitType: 'entity', hitPoint: point };
  }
  return null;
}

// ===== POLYLINE =====

function hitTestPolyline(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('vertices' in entity)) return null;
  const polylineEntity = entity as { vertices: Point2D[]; closed?: boolean };
  const vertices = polylineEntity.vertices;
  if (!vertices || vertices.length < 2) return null;

  const edgeCount = polylineEntity.closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < edgeCount; i++) {
    const nextIndex = (i + 1) % vertices.length;
    const distance = pointToLineDistance(point, vertices[i], vertices[nextIndex]);

    if (distance <= tolerance) {
      return {
        hitType: 'entity',
        hitPoint: closestPointOnLine(point, vertices[i], vertices[nextIndex]),
        edgeIndex: i,
      };
    }
  }

  // Closed polylines: also detect cursor inside polygon body
  if (polylineEntity.closed && vertices.length >= 3 && isPointInPolygon(point, vertices)) {
    return { hitType: 'entity', hitPoint: point };
  }

  return null;
}

// ===== RECTANGLE =====

function hitTestRectangle(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('x' in entity) || !('y' in entity) || !('width' in entity) || !('height' in entity)) {
    return null;
  }
  const rect = entity as { x: number; y: number; width: number; height: number };
  const vertices: Point2D[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  for (let i = 0; i < 4; i++) {
    const nextIndex = (i + 1) % 4;
    const distance = pointToLineDistance(point, vertices[i], vertices[nextIndex]);
    if (distance <= tolerance) {
      return {
        hitType: 'entity',
        hitPoint: closestPointOnLine(point, vertices[i], vertices[nextIndex]),
        edgeIndex: i,
      };
    }
  }
  return null;
}

// ===== TEXT / MTEXT =====

function hitTestText(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('position' in entity)) return null;
  const position = entity.position as Point2D;
  if (!position) return null;

  // Support flat `text` field (DXF-imported) and `textNode` AST (CreateTextCommand).
  let text = ('text' in entity ? entity.text : undefined) as string | undefined;
  if (!text) {
    type TextNodeShape = { paragraphs?: Array<{ runs?: Array<{ text?: string }> }> };
    const textNode = ('textNode' in entity ? entity.textNode : undefined) as TextNodeShape | undefined;
    if (textNode?.paragraphs) {
      text = textNode.paragraphs
        .map(p => (p.runs ?? []).map(r => r.text ?? '').join(''))
        .join('') || undefined;
    }
  }
  if (!text) return null;

  const height = ('height' in entity && typeof entity.height === 'number' && entity.height > 0)
    ? entity.height as number
    : ('fontSize' in entity && typeof entity.fontSize === 'number' && entity.fontSize > 0)
      ? entity.fontSize as number
      : 2.5;

  const rotation = ('rotation' in entity && typeof entity.rotation === 'number')
    ? entity.rotation as number
    : 0;

  const width = text.length * height * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

  let testPoint = point;
  if (rotation !== 0) {
    const rad = degToRad(-rotation);
    const dx = point.x - position.x;
    const dy = point.y - position.y;
    testPoint = {
      x: position.x + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: position.y + dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  }

  const minX = position.x;
  const maxX = position.x + width;
  const minY = position.y - height;
  const maxY = position.y;

  if (testPoint.x >= minX - tolerance &&
      testPoint.x <= maxX + tolerance &&
      testPoint.y >= minY - tolerance &&
      testPoint.y <= maxY + tolerance) {
    return { hitType: 'entity', hitPoint: point };
  }
  return null;
}

// ===== ANGLE MEASUREMENT =====

function hitTestAngleMeasurement(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!('vertex' in entity) || !('point1' in entity) || !('point2' in entity)) return null;
  const angleMeasurement = entity as { vertex: Point2D; point1: Point2D; point2: Point2D };

  const distArm1 = pointToLineDistance(point, angleMeasurement.vertex, angleMeasurement.point1);
  if (distArm1 <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, angleMeasurement.vertex, angleMeasurement.point1) };
  }

  const distArm2 = pointToLineDistance(point, angleMeasurement.vertex, angleMeasurement.point2);
  if (distArm2 <= tolerance) {
    return { hitType: 'entity', hitPoint: closestPointOnLine(point, angleMeasurement.vertex, angleMeasurement.point2) };
  }
  return null;
}

// ===== DIMENSION =====

/**
 * ADR-362 Phase I3 — Geometry-aware hit test for DimensionEntity.
 *
 * defPoints semantic (all variants):
 *   [0] = ext-line origin 1  [1] = ext-line origin 2  [2] = dim-line ref
 * textMidpoint = label position (computed fallback: midpt(pts[0], pts[1]))
 *
 * Tests (in priority order):
 *   1. Text label — point in circle (tolerance × 1.5)
 *   2. Approximate ext lines — segments pts[0]→pts[2] and pts[1]→pts[2]
 *   3. Approximate dim line — segment pts[0]→pts[1] (radial/ordinate: only pts)
 *   4. Proximity to any individual defPoint (catch clicks on extension origins)
 */
function hitTestDimension(entity: DimensionEntity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  const pts = entity.defPoints;
  if (!pts || pts.length === 0) return null;

  const textPt = entity.textMidpoint ?? (pts.length >= 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0]);
  if (calculateDistance(point, textPt) <= tolerance * 1.5) {
    return { hitType: 'entity', hitPoint: textPt };
  }

  // Extension lines: pts[0]→pts[2] and pts[1]→pts[2] (linear/aligned/angular)
  if (pts.length >= 3) {
    const d0 = pointToLineDistance(point, pts[0], pts[2]);
    if (d0 <= tolerance) {
      return { hitType: 'entity', hitPoint: closestPointOnLine(point, pts[0], pts[2]) };
    }
    const d1 = pointToLineDistance(point, pts[1], pts[2]);
    if (d1 <= tolerance) {
      return { hitType: 'entity', hitPoint: closestPointOnLine(point, pts[1], pts[2]) };
    }
  }

  // Dimension line / leader: segment between first two defPoints
  if (pts.length >= 2) {
    const dLine = pointToLineDistance(point, pts[0], pts[1]);
    if (dLine <= tolerance) {
      return { hitType: 'entity', hitPoint: closestPointOnLine(point, pts[0], pts[1]) };
    }
  }

  // Fallback: proximity to any defPoint (catches clicks on arrowhead endpoints)
  for (const pt of pts) {
    if (calculateDistance(point, pt) <= tolerance) {
      return { hitType: 'entity', hitPoint: pt };
    }
  }

  return null;
}

// ===== SNAP STUBS =====

export function getVertexSnap(_entity: Entity, _point: Point2D, _maxDistance: number): SnapResult | null {
  return null;
}

export function getEdgeSnap(_entity: Entity, _point: Point2D, _maxDistance: number): SnapResult | null {
  return null;
}

export function getCenterSnap(_entity: Entity, _point: Point2D, _maxDistance: number): SnapResult | null {
  return null;
}

export function getGridSnap(_point: Point2D, _tolerance: number): SnapResult | null {
  return null;
}

// ===== GEOMETRY HELPERS =====

export function closestPointOnLine(point: Point2D, lineStart: Point2D, lineEnd: Point2D): Point2D {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  if (lenSq === 0) return lineStart;

  const param = clamp(dot / lenSq, 0, 1);
  return {
    x: lineStart.x + param * C,
    y: lineStart.y + param * D,
  };
}

// ===== XLINE =====

function hitTestXLine(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  type XLike = { basePoint?: Point2D; direction?: Point2D };
  const { basePoint, direction } = entity as XLike;
  if (!basePoint || !direction) return null;
  const dist = pointToInfiniteLineDistance(point, basePoint, direction);
  return dist <= tolerance ? { hitType: 'entity', hitPoint: point } : null;
}

// ===== RAY =====

function hitTestRay(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  type RLike = { basePoint?: Point2D; direction?: Point2D };
  const { basePoint, direction } = entity as RLike;
  if (!basePoint || !direction) return null;
  const dist = pointToRayDistance(point, basePoint, direction);
  return dist <= tolerance ? { hitType: 'entity', hitPoint: point } : null;
}
