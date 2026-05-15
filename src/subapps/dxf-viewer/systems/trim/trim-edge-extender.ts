/**
 * TRIM EDGE EXTENDER — ADR-350 (EDGEMODE = 1)
 *
 * Produces virtually-extended cutting-edge geometry for the Edge mode toggle.
 * The original entity is never mutated — extension is a transient overlay
 * used only for intersection computation during a single TRIM pick.
 *
 * Industry rules (5/5 vendor convergence):
 *   - LINE   → infinite (XLINE through start/end direction)
 *   - ARC    → full CIRCLE
 *   - ELLIPTICAL ARC → full ELLIPSE
 *   - RAY    → XLINE
 *   - XLINE  → unchanged (already infinite)
 *   - POLYLINE / SPLINE → unchanged (extension at endpoint only — handled by
 *     trim-entity-cutter when intersection on the natural tangent is needed)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-350-trim-command.md §Core Mathematics #6
 */

import {
  isArcEntity,
  isEllipseEntity,
  isLineEntity,
  isRayEntity,
  type ArcEntity,
  type EllipseEntity,
  type Entity,
  type LineEntity,
  type RayEntity,
  type XLineEntity,
} from '../../types/entities';

/**
 * Returns a transient {@link Entity} representing the natural geometric
 * extension of `edge`, or the original edge if no extension applies.
 *
 * The returned entity preserves the source `id` so the trim pipeline can
 * map intersection points back to the real cutting entity for undo.
 */
export function extendEdge(edge: Entity): Entity {
  if (isLineEntity(edge)) return lineToXLine(edge);
  if (isArcEntity(edge)) return arcToCircle(edge);
  if (isEllipseEntity(edge) && isElliptical(edge)) return ellipseArcToFull(edge);
  if (isRayEntity(edge)) return rayToXLine(edge);
  return edge;
}

function lineToXLine(line: LineEntity): XLineEntity {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  return {
    id: line.id,
    type: 'xline',
    basePoint: line.start,
    direction: { x: dx, y: dy },
    layer: line.layer,
    visible: line.visible,
  };
}

function arcToCircle(arc: ArcEntity): Entity {
  return {
    id: arc.id,
    type: 'circle',
    center: arc.center,
    radius: arc.radius,
    layer: arc.layer,
    visible: arc.visible,
  };
}

function ellipseArcToFull(ell: EllipseEntity): EllipseEntity {
  // Strip startParam/endParam → full sweep.
  const { startParam: _s, endParam: _e, ...rest } = ell;
  return { ...rest } as EllipseEntity;
}

function rayToXLine(ray: RayEntity): XLineEntity {
  return {
    id: ray.id,
    type: 'xline',
    basePoint: ray.basePoint,
    direction: ray.direction,
    layer: ray.layer,
    visible: ray.visible,
  };
}

function isElliptical(e: EllipseEntity): boolean {
  return e.startParam !== undefined && e.endParam !== undefined && e.startParam !== e.endParam;
}
