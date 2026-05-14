/**
 * MIRROR MATH UTILITIES — SSoT for all mirror/reflection calculations
 *
 * ADR-XXX: Entity Mirror System
 * Single Source of Truth for all reflection math.
 *
 * @see rotation-math.ts for the analogous rotation utilities
 */

import type { Point2D } from '../rendering/types/Types';
import type { Entity } from '../types/entities';
import { normalizeAngleDeg } from '../rendering/entities/shared/geometry-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface MirrorAxis {
  p1: Point2D;
  p2: Point2D;
}

// ============================================================================
// PRIMITIVES
// ============================================================================

/**
 * Mirror a point across a line defined by two points.
 *
 * Translate-Foot-Reflect method:
 *   foot = p1 + t*(p2-p1), where t = (P-p1)·(p2-p1) / |p2-p1|²
 *   mirror = 2*foot - P
 */
export function mirrorPoint(p: Point2D, axis: MirrorAxis): Point2D {
  const dx = axis.p2.x - axis.p1.x;
  const dy = axis.p2.y - axis.p1.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-10) return { x: p.x, y: p.y };
  const t = ((p.x - axis.p1.x) * dx + (p.y - axis.p1.y) * dy) / len2;
  const footX = axis.p1.x + t * dx;
  const footY = axis.p1.y + t * dy;
  return { x: 2 * footX - p.x, y: 2 * footY - p.y };
}

/**
 * Mirror an angle across a line at axisAngleDeg.
 * Formula: mirroredAngle = 2 * axisAngle - angle
 */
export function mirrorAngle(angleDeg: number, axisAngleDeg: number): number {
  return normalizeAngleDeg(2 * axisAngleDeg - angleDeg);
}

/** Compute the angle of the mirror axis in degrees. */
export function getAxisAngleDeg(axis: MirrorAxis): number {
  return Math.atan2(axis.p2.y - axis.p1.y, axis.p2.x - axis.p1.x) * (180 / Math.PI);
}

/**
 * AutoCAD-style ortho snap: project `to` onto the dominant H or V axis from `from`.
 * Used when Ortho mode is active or Shift is held during axis definition.
 */
export function orthoSnap(from: Point2D, to: Point2D): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y };
}

// ============================================================================
// ENTITY MIRROR
// ============================================================================

/**
 * Mirror entity geometry across the given axis (ADR-XXX §6.2).
 *
 * Returns a partial update object for sceneManager.updateEntity().
 * Handles all entity types: line, circle, arc, polyline, lwpolyline,
 * rectangle, rect, ellipse, text, mtext, spline, angle-measurement.
 *
 * For arc: start/end angles swap because sweep direction reverses on reflection.
 */
export function mirrorEntity(entity: Entity, axis: MirrorAxis): Partial<Entity> {
  const axAngle = getAxisAngleDeg(axis);
  const mp = (p: Point2D) => mirrorPoint(p, axis);
  const ma = (a: number) => mirrorAngle(a, axAngle);

  switch (entity.type) {
    case 'line':
      return { start: mp(entity.start), end: mp(entity.end) };

    case 'circle':
      return { center: mp(entity.center) };

    case 'arc':
      return {
        center: mp(entity.center),
        startAngle: normalizeAngleDeg(ma(entity.endAngle)),
        endAngle: normalizeAngleDeg(ma(entity.startAngle)),
      };

    case 'polyline':
    case 'lwpolyline':
      return { vertices: entity.vertices.map(mp) };

    case 'rectangle':
    case 'rect': {
      const origin = mp({ x: entity.x, y: entity.y });
      const updates: Partial<Entity> = {
        x: origin.x,
        y: origin.y,
        rotation: normalizeAngleDeg(ma(entity.rotation ?? 0)),
      };
      if (entity.corner1 && entity.corner2) {
        updates.corner1 = mp(entity.corner1);
        updates.corner2 = mp(entity.corner2);
      }
      return updates;
    }

    case 'ellipse':
      return {
        center: mp(entity.center),
        rotation: normalizeAngleDeg(ma(entity.rotation ?? 0)),
      };

    case 'text':
    case 'mtext':
      return {
        position: mp(entity.position),
        rotation: normalizeAngleDeg(ma(entity.rotation ?? 0)),
      };

    case 'spline':
      return { controlPoints: entity.controlPoints.map(mp) };

    case 'angle-measurement':
      return {
        vertex: mp(entity.vertex),
        point1: mp(entity.point1),
        point2: mp(entity.point2),
      };

    default:
      return {};
  }
}
