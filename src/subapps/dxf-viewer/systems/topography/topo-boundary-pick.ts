/**
 * ADR-650 M6 (Γ) — pure core: «κλειστή γραμμή του σχεδίου → όριο υπολογισμού όγκων».
 *
 * The οικόπεδο is already drawn on the plan. Making the user re-trace it would create a second
 * source of truth for the same polygon — so the boundary is PICKED, exactly like the breaklines
 * of M2-Β (Civil 3D: a surface boundary is an existing closed polyline you select).
 *
 * Only CLOSED linear entities qualify: an open polyline has no inside, and «count the earth
 * inside this open line» has no meaning. Refusing it is honest; auto-closing it would invent a
 * boundary the surveyor never drew — and quietly change the volume.
 */

import type { Entity } from '../../types/entities';
import { isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import type { TopoBoundary } from './topo-types';

/** A boundary needs an inside: closed polyline / lwpolyline with at least a triangle's worth of vertices. */
export function isBoundaryCandidate(entity: Entity): boolean {
  return buildBoundaryFromEntity(entity) !== null;
}

/**
 * Build the site boundary from a closed linear entity (WORLD canonical mm, implicitly closed).
 * Returns `null` for anything that is not a usable closed ring — the caller reports it; the
 * volume engine is never handed a boundary it cannot trust.
 *
 * The predicate above delegates here so «what may be picked» and «what is actually built» can
 * never drift apart (the classic pick-tool bug: the cursor accepts a line the builder rejects).
 */
export function buildBoundaryFromEntity(entity: Entity): TopoBoundary | null {
  if (!isPolylineEntity(entity) && !isLWPolylineEntity(entity)) return null;
  if (entity.closed !== true || entity.vertices.length < 3) return null;
  return { vertices: projectVerticesTo2D(entity.vertices), sourceEntityId: entity.id };
}
