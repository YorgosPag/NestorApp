/**
 * ADR-362 Phase J3 (gap #2) — find the 2nd host of an `intersection` snap.
 *
 * When a dim def point snaps to an INTERSECTION OSNAP, the hit-test SSoT
 * (HoverStore) reports only ONE entity under the cursor. The intersection is
 * defined by TWO curves crossing at that point; this self-contained re-detect
 * (handoff "Option A", ZERO change to the shared snap system) scans the scene
 * for the other curve passing through the snapped point.
 *
 * SSoT: distance tests reuse `pointToLineDistance` / `pointToCircleDistance`
 * (geometry-utils) and the arc angle-range test reuses `isAngleInRange`
 * (intersection-calculators) — no new geometry math here.
 *
 * @see hooks/drawing/drawing-handler-utils.ts — caller (resolveDimPickContext)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { DetectableEntity } from './dim-smart-detector';
import {
  pointToLineDistance,
  pointToCircleDistance,
} from '../../rendering/entities/shared/geometry-utils';
import { isAngleInRange } from '../../snapping/engines/intersection-calculators';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';

const RAD_TO_DEG = 180 / Math.PI;

/** Distance from `p` to the nearest point of a detectable entity, or +∞. */
function distanceToEntity(p: Point2D, e: DetectableEntity): number {
  switch (e.type) {
    case 'line':
      return pointToLineDistance(p, e.start, e.end);
    case 'circle':
      return pointToCircleDistance(p, e.center, e.radius);
    case 'arc': {
      const angleDeg = normalizeAngleDeg(Math.atan2(p.y - e.center.y, p.x - e.center.x) * RAD_TO_DEG);
      if (!isAngleInRange(angleDeg, e.startAngle, e.endAngle)) return Infinity;
      return pointToCircleDistance(p, e.center, e.radius);
    }
    case 'polyline':
    case 'lwpolyline': {
      const verts = e.vertices;
      if (!verts || verts.length < 2) return Infinity;
      let min = Infinity;
      const last = e.closed ? verts.length : verts.length - 1;
      for (let i = 0; i < last; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        const d = pointToLineDistance(p, a, b);
        if (d < min) min = d;
      }
      return min;
    }
    default:
      return Infinity;
  }
}

const DETECTABLE = new Set(['line', 'circle', 'arc', 'polyline', 'lwpolyline']);

/**
 * Find the detectable curves passing through `point`, nearest-first (capped at
 * `max`). The snapped point lies on its host curves to full float precision, so
 * true hosts have distance ~0 while unrelated entities are far — a
 * coordinate-scaled epsilon separates them robustly.
 *
 * Why geometric (not HoverStore): the entity-under-cursor hit-test only fills
 * when the cursor is over the entity *body*. At an intersection / endpoint the
 * cursor often isn't, so `getHoveredEntity()` returns nothing — yet both hosts
 * provably pass through the snapped point. This recovers them deterministically
 * so `intersection` (2 hosts) and `nearest`/`endpoint` (1 host) associations are
 * captured reliably regardless of cursor proximity to a body.
 */
export function findHostsAtPoint(
  point: Point2D,
  entities: ReadonlyArray<Entity> | undefined,
  max = 2,
): DetectableEntity[] {
  if (!entities?.length) return [];
  const eps = 1e-6 * (1 + Math.abs(point.x) + Math.abs(point.y));
  const hits: Array<{ entity: DetectableEntity; dist: number }> = [];
  for (const e of entities) {
    if (!DETECTABLE.has(e.type)) continue;
    const candidate = e as DetectableEntity;
    const d = distanceToEntity(point, candidate);
    if (d <= eps) hits.push({ entity: candidate, dist: d });
  }
  hits.sort((a, b) => a.dist - b.dist);
  return hits.slice(0, max).map((h) => h.entity);
}
