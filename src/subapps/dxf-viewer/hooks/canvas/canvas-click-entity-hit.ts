/**
 * 🏢 ENTERPRISE: Canvas click entity hit-testing helpers
 *
 * @description Pure geometric hit-testing used by the rotation tool's
 * entity-selection phase (PRIORITY 1.3 in `useCanvasClickHandler`). Extracted
 * from `useCanvasClickHandler.ts` to keep that hook under the 500-line limit
 * (N.7.1) — no behaviour change, the functions are byte-identical to their
 * previous in-file definitions.
 *
 * @see ADR-188: Rotation tool entity selection
 */
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isLineEntity, isPolylineEntity, isLWPolylineEntity,
  isArcEntity, isCircleEntity, isRectangleEntity, isRectEntity,
  isTextEntity, isMTextEntity, isEllipseEntity,
} from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { resolveEntityText } from '../../utils/text-node-utils';

/**
 * Tests if a world point hits any entity type. Returns true if hit.
 * Supports: LINE, ARC, CIRCLE, POLYLINE, LWPOLYLINE, RECTANGLE, ELLIPSE, TEXT, MTEXT.
 */
export function testEntityHit(
  worldPoint: Point2D,
  entity: Entity,
  hitTolerance: number,
): boolean {
  if (isLineEntity(entity)) {
    return pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance;
  }
  if (isArcEntity(entity)) {
    return pointToArcDistance(worldPoint, entity) <= hitTolerance;
  }
  if (isCircleEntity(entity)) {
    const dx = worldPoint.x - entity.center.x;
    const dy = worldPoint.y - entity.center.y;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    return Math.abs(distFromCenter - entity.radius) <= hitTolerance;
  }
  if (isPolylineEntity(entity)) {
    return testPolylineHit(worldPoint, entity.vertices, entity.closed, hitTolerance);
  }
  if (isLWPolylineEntity(entity)) {
    return testPolylineHit(worldPoint, entity.vertices, entity.closed, hitTolerance);
  }
  if (isRectangleEntity(entity) || isRectEntity(entity)) {
    const { x, y, width: w, height: h } = entity;
    const corners = [
      { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
    ];
    for (let i = 0; i < 4; i++) {
      if (pointToLineDistance(worldPoint, corners[i], corners[(i + 1) % 4]) <= hitTolerance) {
        return true;
      }
    }
    return false;
  }
  if (isEllipseEntity(entity)) {
    const dx = worldPoint.x - entity.center.x;
    const dy = worldPoint.y - entity.center.y;
    const rx = entity.majorAxis;
    const ry = entity.minorAxis;
    const normalizedDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    return Math.abs(normalizedDist - 1) <= hitTolerance / Math.min(rx, ry);
  }
  if (isTextEntity(entity)) {
    const height = entity.height ?? entity.fontSize ?? 2.5;
    const width = resolveEntityText(entity).length * height * 0.6;
    return worldPoint.x >= entity.position.x - hitTolerance &&
           worldPoint.x <= entity.position.x + width + hitTolerance &&
           worldPoint.y >= entity.position.y - height - hitTolerance &&
           worldPoint.y <= entity.position.y + hitTolerance;
  }
  if (isMTextEntity(entity)) {
    const height = entity.height ?? entity.fontSize ?? 2.5;
    const width = entity.width || (resolveEntityText(entity).length * height * 0.6);
    return worldPoint.x >= entity.position.x - hitTolerance &&
           worldPoint.x <= entity.position.x + width + hitTolerance &&
           worldPoint.y >= entity.position.y - height - hitTolerance &&
           worldPoint.y <= entity.position.y + hitTolerance;
  }
  return false;
}

/** Helper: Test if point hits a polyline (vertices + optional closed) */
export function testPolylineHit(
  worldPoint: Point2D,
  vertices: ReadonlyArray<{ x: number; y: number }> | undefined,
  closed: boolean | undefined,
  hitTolerance: number,
): boolean {
  if (!vertices || vertices.length < 2) return false;
  for (let i = 0; i < vertices.length - 1; i++) {
    if (pointToLineDistance(worldPoint, vertices[i], vertices[i + 1]) <= hitTolerance) {
      return true;
    }
  }
  if (closed && vertices.length > 2) {
    if (pointToLineDistance(worldPoint, vertices[vertices.length - 1], vertices[0]) <= hitTolerance) {
      return true;
    }
  }
  return false;
}
