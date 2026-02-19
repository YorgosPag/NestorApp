/**
 * ROTATION MATH UTILITIES
 *
 * 🏢 ADR-188: Entity Rotation System — Centralized rotation math
 * Single Source of Truth for all rotation calculations.
 *
 * Conventions (AutoCAD/DXF standard):
 * - Positive angle = counterclockwise (CCW)
 * - Storage unit = degrees
 * - Math operations use radians internally
 *
 * @see ADR-188 §6.1 (Translate-Rotate-Translate method)
 * @see ADR-188 §6.2 (Entity-specific transform logic)
 */

import type { Point2D } from '../rendering/types/Types';
import type { DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';
// 🏢 ADR-067: Centralized angle conversion
import { degToRad, normalizeAngleDeg } from '../rendering/entities/shared/geometry-utils';

/**
 * Rotate a point around a pivot by a given angle.
 *
 * Uses Translate-Rotate-Translate method (ADR-188 §6.1):
 *   x' = (x - bx)·cos(θ) - (y - by)·sin(θ) + bx
 *   y' = (x - bx)·sin(θ) + (y - by)·cos(θ) + by
 *
 * @param point  - Point to rotate
 * @param pivot  - Rotation center (base point)
 * @param angleDeg - Rotation angle in degrees (positive = CCW)
 * @returns Rotated point
 */
export function rotatePoint(point: Point2D, pivot: Point2D, angleDeg: number): Point2D {
  const rad = degToRad(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;

  return {
    x: dx * cos - dy * sin + pivot.x,
    y: dx * sin + dy * cos + pivot.y,
  };
}

/**
 * Rotate entity geometry around a pivot (ADR-188 §6.2).
 *
 * Returns a partial update object suitable for `sceneManager.updateEntity()`.
 * Dispatches to per-entity-type rotation logic:
 *
 * - LINE:  rotate start + end vertices
 * - CIRCLE: rotate center only (radius invariant)
 * - ARC: rotate center + offset startAngle/endAngle by θ
 * - POLYLINE: rotate all vertices
 * - TEXT: rotate position + accumulate rotation field
 * - ANGLE-MEASUREMENT: rotate vertex + point1 + point2, recalculate angle
 *
 * @param entity   - Entity to rotate
 * @param pivot    - Rotation center
 * @param angleDeg - Angle in degrees (positive = CCW)
 * @returns Partial entity update object
 */
export function rotateEntity(
  entity: DxfEntityUnion,
  pivot: Point2D,
  angleDeg: number
): Partial<DxfEntityUnion> {
  switch (entity.type) {
    case 'line':
      return {
        start: rotatePoint(entity.start, pivot, angleDeg),
        end: rotatePoint(entity.end, pivot, angleDeg),
      };

    case 'circle':
      return {
        center: rotatePoint(entity.center, pivot, angleDeg),
      };

    case 'arc':
      return {
        center: rotatePoint(entity.center, pivot, angleDeg),
        startAngle: normalizeAngleDeg(entity.startAngle + angleDeg),
        endAngle: normalizeAngleDeg(entity.endAngle + angleDeg),
      };

    case 'polyline':
      return {
        vertices: entity.vertices.map(v => rotatePoint(v, pivot, angleDeg)),
      };

    case 'text': {
      const currentRotation = entity.rotation ?? 0;
      return {
        position: rotatePoint(entity.position, pivot, angleDeg),
        rotation: normalizeAngleDeg(currentRotation + angleDeg),
      };
    }

    case 'angle-measurement': {
      const newVertex = rotatePoint(entity.vertex, pivot, angleDeg);
      const newPoint1 = rotatePoint(entity.point1, pivot, angleDeg);
      const newPoint2 = rotatePoint(entity.point2, pivot, angleDeg);
      // Angle between arms is invariant under rotation — keep original angle value
      return {
        vertex: newVertex,
        point1: newPoint1,
        point2: newPoint2,
      };
    }

    default:
      return {};
  }
}

/**
 * Calculate the angle in degrees from a pivot to a point.
 * Returns value in [0, 360) — useful for mouse-based angle picking.
 *
 * @param pivot - Origin of angle measurement
 * @param point - Target point
 * @returns Angle in degrees [0, 360), measured CCW from positive X-axis
 */
export function angleBetweenPointsDeg(pivot: Point2D, point: Point2D): number {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  const rad = Math.atan2(dy, dx);
  return normalizeAngleDeg(rad * (180 / Math.PI));
}
