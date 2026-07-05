/**
 * Entity-Specific Hit Tests — ADR-065 SRP split
 * Per-entity-type precise hit testing functions.
 * Extracted from HitTester.ts.
 */

import type { Point2D } from '../types/Types';
import type { Entity, DimensionEntity } from '../../types/entities';
import { closedRingFromEdges, projectPointTo2D, projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import {
  isOpeningEntity,
  isSlabOpeningEntity,
  isWallEntity,
  isSlabEntity,
  isColumnEntity,
  isBeamEntity,
  isFloorFinishEntity,
  isWallCoveringEntity,
  isFoundationEntity,
  isSpaceSeparatorEntity,
  isHatchEntity,
} from '../../types/entities';
import type { HitTestResult, SnapResult } from './hit-tester-types';
import { pointToLineDistance, clamp } from '../entities/shared/geometry-utils';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { calculateDistance } from '../entities/shared/geometry-rendering-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { pointToInfiniteLineDistance } from '../utils/point-to-line-distance';
import { pointToRayDistance } from '../utils/point-to-line-distance';
// ADR-362/measurement — annotation hit-tests extracted to a sibling module (N.7.1).
import { hitTestText, hitTestAngleMeasurement, hitTestDimension } from './hit-test-annotations';
// ADR-362 Phase I3 hotfix (2026-05-19) — SSoT for dim foot points / text anchor.
import { HINGE_ARC_SUBDIVISIONS } from '../../bim/geometry/opening-geometry';

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
    // ADR-363 Bug 1 fix — polygon containment για BIM entities. Cached outline
    // vertices στο `geometry`/`params` δίνουν τα 4-vertex (opening/slab-opening)
    // ή N-vertex (slab/column/beam) world-coord polygons. Wall uses outerEdge +
    // innerEdge reversed ένωση για το cross-section footprint. Stair πέφτει στο
    // default bbox-only — detailed treads/stringers hit-test = separate ratchet.
    case 'opening': return hitTestOpening(entity, point, tolerance);
    case 'slab-opening': return hitTestSlabOpening(entity, point);
    case 'slab': return hitTestSlab(entity, point);
    case 'wall': return hitTestWall(entity, point);
    case 'column': return hitTestColumn(entity, point);
    case 'beam': return hitTestBeam(entity, point);
    // ADR-436 Slice 1b — foundation footprint polygon containment (mirror column).
    case 'foundation': return hitTestFoundation(entity, point);
    // ADR-419 — floor-finish polygon containment (same as slab/slab-opening).
    case 'floor-finish': return hitTestFloorFinish(entity, point);
    // ADR-511 — wall-covering strip containment (cached outline from host wall).
    case 'wall-covering': return hitTestWallCovering(entity, point);
    // ADR-437 — space separator: point-to-segment distance (a thin line needs a
    // tolerance corridor, NOT bbox-only — else the diagonal-line bbox over-selects).
    case 'space-separator': return hitTestSpaceSeparator(entity, point, tolerance);
    // ADR-507 — hatch even-odd polygon containment (outer ring minus island rings),
    // mirror of HatchRenderer.hitTest. Without this it fell to `default` = AABB-only
    // (over-selects non-convex hatches + the gaps between islands).
    case 'hatch': return hitTestHatch(entity, point);
    default: return { hitType: 'entity', hitPoint: point };
  }
}

function hitTestHatch(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isHatchEntity(entity)) return null;
  const paths = (entity.boundaryPaths ?? []).filter((p) => p.length >= 3);
  if (paths.length === 0) return null;
  let inside = 0;
  for (const path of paths) if (isPointInPolygon(point, projectVerticesTo2D(path))) inside += 1;
  return inside % 2 === 1 ? { hitType: 'entity', hitPoint: point } : null;
}

// ===== BIM ENTITIES (ADR-363 Bug 1 — polygon containment) =====

function hitTestOpening(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
  if (!isOpeningEntity(entity)) return null;
  const geom = entity.geometry;
  if (!geom) return null;

  // 1. Outline rectangle (cutout inside wall thickness).
  const verts = geom.outline?.vertices;
  if (verts && verts.length >= 3 && isPointInPolygon(point, projectVerticesTo2D(verts))) {
    return { hitType: 'entity', hitPoint: point };
  }

  const arc = geom.hingeArc;
  const hinge = geom.hingeAnchor;

  // 2. Leaf line(s) — solid door panel at 90°-open position.
  if (hinge && arc && arc.points.length > HINGE_ARC_SUBDIVISIONS) {
    if (pointToLineDistance(point, projectPointTo2D(hinge), projectPointTo2D(arc.points[HINGE_ARC_SUBDIVISIONS])) <= tolerance) {
      return { hitType: 'entity', hitPoint: point };
    }
    const hinge2 = geom.hingeAnchor2;
    if (hinge2 && arc.points.length > HINGE_ARC_SUBDIVISIONS + 1) {
      if (pointToLineDistance(point, projectPointTo2D(hinge2), projectPointTo2D(arc.points[HINGE_ARC_SUBDIVISIONS + 1])) <= tolerance) {
        return { hitType: 'entity', hitPoint: point };
      }
    }
  }

  // 3. Swing arc — test each chord segment.
  if (arc && arc.points.length >= 2) {
    for (let i = 0; i < arc.points.length - 1; i++) {
      if (pointToLineDistance(point, projectPointTo2D(arc.points[i]), projectPointTo2D(arc.points[i + 1])) <= tolerance) {
        return { hitType: 'entity', hitPoint: point };
      }
    }
  }

  return null;
}

function hitTestSlabOpening(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isSlabOpeningEntity(entity)) return null;
  const verts = entity.params?.outline?.vertices;
  if (!verts || verts.length < 3) return null;
  return isPointInPolygon(point, projectVerticesTo2D(verts)) ? { hitType: 'entity', hitPoint: point } : null;
}

function hitTestSlab(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isSlabEntity(entity)) return null;
  const verts = entity.params?.outline?.vertices;
  if (!verts || verts.length < 3) return null;
  return isPointInPolygon(point, projectVerticesTo2D(verts)) ? { hitType: 'entity', hitPoint: point } : null;
}

function hitTestFloorFinish(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isFloorFinishEntity(entity)) return null;
  const verts = entity.params?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  return isPointInPolygon(point, projectVerticesTo2D(verts)) ? { hitType: 'entity', hitPoint: point } : null;
}

function hitTestWallCovering(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isWallCoveringEntity(entity)) return null;
  // Cached strip outline (4 σημεία) από τον host τοίχο (build/edit time). Absent αν ο host
  // έλειπε στο build → no precise target (πέφτει σε broad-phase bbox μέσω geometry.bbox).
  const outline = entity.geometry?.outline;
  if (!outline || outline.length < 3) return null;
  return isPointInPolygon(point, projectVerticesTo2D(outline)) ? { hitType: 'entity', hitPoint: point } : null;
}

function hitTestSpaceSeparator(
  entity: Entity, point: Point2D, tolerance: number,
): Partial<HitTestResult> | null {
  if (!isSpaceSeparatorEntity(entity)) return null;
  const { start, end } = entity.params;
  if (!start || !end) return null;
  return pointToLineDistance(point, projectPointTo2D(start), projectPointTo2D(end)) <= tolerance
    ? { hitType: 'entity', hitPoint: point }
    : null;
}

function hitTestWall(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isWallEntity(entity)) return null;
  const outer = entity.geometry?.outerEdge?.points;
  const inner = entity.geometry?.innerEdge?.points;
  if (!outer || !inner || outer.length < 2 || inner.length < 2) return null;
  // Build closed footprint: outer forward + inner reversed (matches buildWallShape) — SSoT.
  const ring: Point2D[] = closedRingFromEdges(outer, inner).map(to2D);
  if (ring.length < 3) return null;
  return isPointInPolygon(point, ring) ? { hitType: 'entity', hitPoint: point } : null;
}

function hitTestColumn(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isColumnEntity(entity)) return null;
  const verts = entity.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  return isPointInPolygon(point, projectVerticesTo2D(verts)) ? { hitType: 'entity', hitPoint: point } : null;
}

// ADR-436 Slice 1b — foundation footprint containment (pad/strip/tie-beam all
// expose `geometry.footprint.vertices`; identical to column polygon test).
function hitTestFoundation(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isFoundationEntity(entity)) return null;
  const verts = entity.geometry?.footprint?.vertices;
  if (!verts || verts.length < 3) return null;
  return isPointInPolygon(point, projectVerticesTo2D(verts)) ? { hitType: 'entity', hitPoint: point } : null;
}

function hitTestBeam(entity: Entity, point: Point2D): Partial<HitTestResult> | null {
  if (!isBeamEntity(entity)) return null;
  const verts = entity.geometry?.outline?.vertices;
  if (!verts || verts.length < 3) return null;
  return isPointInPolygon(point, projectVerticesTo2D(verts)) ? { hitType: 'entity', hitPoint: point } : null;
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
  const arcEntity = entity as { center: Point2D; radius: number; startAngle: number; endAngle: number; counterclockwise?: boolean };
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

// ===== TEXT / ANGLE / DIMENSION =====
// Annotation hit-tests extracted to `hit-test-annotations.ts` (N.7.1); the
// dispatcher above calls the three entry points re-imported at the top.

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
