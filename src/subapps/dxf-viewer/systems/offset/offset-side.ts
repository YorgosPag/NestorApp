/**
 * OFFSET — cursor → signed distance (side + magnitude) resolution (ADR-510 Φ4d).
 *
 * The «άμεσο» UX drives the offset distance straight from the cursor: the SIGN
 * encodes which side, the MAGNITUDE the distance. Each entity type has its own
 * sign convention, matched 1:1 by `offset-entity-geometry.ts`:
 *   • LINE      → signed perpendicular distance (left of travel = positive)
 *   • CIRCLE/ARC→ `|cursor − centre| − radius` (outside = positive → bigger)
 *   • POLYLINE  → signed perpendicular distance to the NEAREST segment (left = +)
 *
 * When the user types an exact distance, the caller keeps only the SIGN from here
 * and substitutes the typed magnitude.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isLineEntity,
  isCircleEntity,
  isArcEntity,
  isPolylineEntity,
  isLWPolylineEntity,
} from '../../types/entities';
import { signedDistanceToLine, calculateDistance } from '../../rendering/entities/shared/geometry-vector-utils';
import { pointToSegmentDistance } from '../guides/guide-types';

function nearestSegmentSignedDistance(vertices: readonly Point2D[], closed: boolean, cursor: Point2D): number | null {
  const n = vertices.length;
  if (n < 2) return null;
  const segCount = closed ? n : n - 1;
  let best = Number.POSITIVE_INFINITY;
  let signed = 0;
  for (let i = 0; i < segCount; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const dist = pointToSegmentDistance(cursor, a, b);
    if (dist < best) {
      best = dist;
      signed = signedDistanceToLine(cursor, a, b);
    }
  }
  return signed;
}

/**
 * Signed, cursor-driven offset distance for `entity`. Returns null for
 * unsupported types or when the geometry is degenerate.
 */
export function resolveOffsetDistance(entity: Entity, cursor: Point2D): number | null {
  if (isLineEntity(entity)) return signedDistanceToLine(cursor, entity.start, entity.end);
  if (isCircleEntity(entity) || isArcEntity(entity)) {
    return calculateDistance(cursor, entity.center) - entity.radius;
  }
  if (isPolylineEntity(entity) || isLWPolylineEntity(entity)) {
    return nearestSegmentSignedDistance(entity.vertices, entity.closed === true, cursor);
  }
  return null;
}

/**
 * Final signed distance for the ghost/commit: cursor-driven, or (when the user has
 * typed an exact distance) the typed magnitude keeping only the cursor's SIDE.
 * Returns null when the entity is unsupported or the cursor sits on the entity.
 */
export function resolveSignedOffset(entity: Entity, cursor: Point2D, typedDistance: number | null): number | null {
  const base = resolveOffsetDistance(entity, cursor);
  if (base === null || base === 0) return null;
  return typedDistance != null ? Math.sign(base) * typedDistance : base;
}
