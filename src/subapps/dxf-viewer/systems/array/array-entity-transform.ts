/**
 * ADR-353 SSOT — Per-entity-type transform dispatcher for array items.
 *
 * Each call deep-clones the source entity and applies the given ItemTransform
 * (translate + rotate) to produce one independent array item.
 *
 * Follows the pattern of scale-entity-transform.ts (ADR-348).
 *
 * Forbidden: ArrayEntity as source (nested arrays blocked — Q19).
 */

import type { Entity } from '../../types/entities';
import type { ItemTransform } from './types';
import type { Point2D } from '../../rendering/types/Types';
import { rotatePoint } from '../../utils/rotation-math';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-utils';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

// ── Internal helpers ──────────────────────────────────────────────────────────

function transformPoint(p: Point2D, t: ItemTransform, pivot: Point2D): Point2D {
  const translated = translatePoint(p, { x: t.translateX, y: t.translateY });
  if (t.rotateDeg === 0) return translated;
  return rotatePoint(translated, { x: pivot.x + t.translateX, y: pivot.y + t.translateY }, t.rotateDeg);
}

function transformPoints(pts: Point2D[], t: ItemTransform, pivot: Point2D): Point2D[] {
  return pts.map(p => transformPoint(p, t, pivot));
}

// ── Per-type transform functions ──────────────────────────────────────────────

function transformLine(
  e: Extract<Entity, { type: 'line' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    start: transformPoint(e.start, t, pivot),
    end: transformPoint(e.end, t, pivot),
  };
}

function transformCircle(
  e: Extract<Entity, { type: 'circle' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    center: transformPoint(e.center, t, pivot),
  };
}

function transformArc(
  e: Extract<Entity, { type: 'arc' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    center: transformPoint(e.center, t, pivot),
    startAngle: t.rotateDeg !== 0
      ? normalizeAngleDeg(e.startAngle + t.rotateDeg)
      : e.startAngle,
    endAngle: t.rotateDeg !== 0
      ? normalizeAngleDeg(e.endAngle + t.rotateDeg)
      : e.endAngle,
  };
}

function transformPolyline(
  e: Extract<Entity, { type: 'polyline' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    vertices: transformPoints(e.vertices, t, pivot),
  };
}

function transformLWPolyline(
  e: Extract<Entity, { type: 'lwpolyline' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    vertices: transformPoints(e.vertices, t, pivot),
  };
}

function transformEllipse(
  e: Extract<Entity, { type: 'ellipse' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    center: transformPoint(e.center, t, pivot),
    rotation: t.rotateDeg !== 0
      ? normalizeAngleDeg((e.rotation ?? 0) + t.rotateDeg)
      : (e.rotation ?? 0),
  };
}

function transformSpline(
  e: Extract<Entity, { type: 'spline' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    controlPoints: transformPoints(e.controlPoints, t, pivot),
  };
}

/** Accumulate a rotation delta onto an existing (optional) angle, normalized. Identity when
 *  delta is 0 so a translate-only array item keeps its exact source angle. */
function accumulateRotationDeg(current: number | undefined, deltaDeg: number): number {
  return deltaDeg !== 0 ? normalizeAngleDeg((current ?? 0) + deltaDeg) : (current ?? 0);
}

/**
 * Position-anchored, rotatable entities (text, mtext, image) share ONE transform: move the
 * `position` anchor and accumulate `rotation`. SSoT — replaces the per-type sibling twins
 * (N.18 anti-clone). ImageEntity `position` = bottom-left corner (y-up, DXF INSERT); its
 * `rotation` is CCW around that anchor — identical shape to text — so the array clone stays a
 * valid ImageEntity (url + intrinsic size + dxfImageExport ride along via `...e`). ADR-651/654.
 */
function transformPositioned(
  e: Extract<Entity, { type: 'text' | 'mtext' | 'image' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    position: transformPoint(e.position, t, pivot),
    rotation: accumulateRotationDeg(e.rotation, t.rotateDeg),
  };
}

function transformHatch(
  e: Extract<Entity, { type: 'hatch' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    boundaryPaths: e.boundaryPaths.map(path => transformPoints(path, t, pivot)),
  };
}

/**
 * Corner-anchored rectangles (`rectangle`, `rect`) share ONE transform: move the `x,y` origin +
 * optional `corner1/corner2` and accumulate `rotation`. SSoT — replaces the two identical twins.
 */
function transformBoxRect(
  e: Extract<Entity, { type: 'rectangle' | 'rect' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  const origin = transformPoint({ x: e.x, y: e.y }, t, pivot);
  return {
    ...e,
    x: origin.x,
    y: origin.y,
    rotation: accumulateRotationDeg(e.rotation, t.rotateDeg),
    corner1: e.corner1 ? transformPoint(e.corner1, t, pivot) : undefined,
    corner2: e.corner2 ? transformPoint(e.corner2, t, pivot) : undefined,
  };
}

function transformDimension(
  e: Extract<Entity, { type: 'dimension' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    ...(e.startPoint !== undefined && { startPoint: transformPoint(e.startPoint, t, pivot) }),
    ...(e.endPoint !== undefined && { endPoint: transformPoint(e.endPoint, t, pivot) }),
    ...(e.textPosition !== undefined && { textPosition: transformPoint(e.textPosition, t, pivot) }),
  };
}

function transformLeader(
  e: Extract<Entity, { type: 'leader' }>,
  t: ItemTransform,
  pivot: Point2D,
): Entity {
  return {
    ...e,
    vertices: transformPoints(e.vertices, t, pivot),
    annotationPosition: e.annotationPosition
      ? transformPoint(e.annotationPosition, t, pivot)
      : undefined,
  };
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

/**
 * Apply an ItemTransform to a source entity and return the transformed clone.
 *
 * The clone shares all non-geometric properties with the source. ID is
 * preserved — callers that need unique IDs must reassign after calling.
 *
 * ArrayEntity as source is explicitly forbidden (nested arrays — ADR-353 Q19).
 *
 * @param entity    - Source entity
 * @param transform - Translation + rotation to apply
 * @param pivot     - Base point of the source group (bbox center); rotations
 *                    are applied around (pivot + translate) to keep items
 *                    geometrically correct.
 */
export function applyTransformToEntity(
  entity: Entity,
  transform: ItemTransform,
  pivot: Point2D,
): Entity {
  switch (entity.type) {
    case 'line':      return transformLine(entity, transform, pivot);
    case 'circle':    return transformCircle(entity, transform, pivot);
    case 'arc':       return transformArc(entity, transform, pivot);
    case 'polyline':  return transformPolyline(entity, transform, pivot);
    case 'lwpolyline':return transformLWPolyline(entity, transform, pivot);
    case 'ellipse':   return transformEllipse(entity, transform, pivot);
    case 'spline':    return transformSpline(entity, transform, pivot);
    case 'text':      return transformPositioned(entity, transform, pivot);
    case 'mtext':     return transformPositioned(entity, transform, pivot);
    case 'image':     return transformPositioned(entity, transform, pivot);
    case 'hatch':     return transformHatch(entity, transform, pivot);
    case 'rectangle': return transformBoxRect(entity, transform, pivot);
    case 'rect':      return transformBoxRect(entity, transform, pivot);
    case 'dimension': return transformDimension(entity, transform, pivot);
    case 'leader':    return transformLeader(entity, transform, pivot);
    default:
      // point, block, angle-measurement, xline, ray — translate only
      return translateEntityFallback(entity, transform);
  }
}

function translateEntityFallback(entity: Entity, t: ItemTransform): Entity {
  // Best-effort: translate any known positional fields
  const e = entity as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = { ...e };
  if (typeof e['position'] === 'object' && e['position'] !== null) {
    const p = e['position'] as Point2D;
    result['position'] = translatePoint(p, { x: t.translateX, y: t.translateY });
  }
  if (typeof e['center'] === 'object' && e['center'] !== null) {
    const c = e['center'] as Point2D;
    result['center'] = translatePoint(c, { x: t.translateX, y: t.translateY });
  }
  if (typeof e['basePoint'] === 'object' && e['basePoint'] !== null) {
    const bp = e['basePoint'] as Point2D;
    result['basePoint'] = translatePoint(bp, { x: t.translateX, y: t.translateY });
  }
  return result as unknown as Entity;
}
