/**
 * clip-entity-helpers — SSoT για το crop orchestration που ΜΟΙΡΑΖΟΝΤΑΙ όλοι οι
 * region τρόποι (ορθογώνιο / πολύγωνο / λάσσο) μέσω injected `ClipRegion` primitives.
 *
 * @see clip-entity.ts (caller) / clip-region.ts (region strategies)
 */

import type { Entity, HatchEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { getEntityRenderBounds, type SpatialBounds } from '../../types/entity-bounds';

/**
 * Clip μιας γραμμοσκίασης ανά boundary loop (path[0] = εξωτερικό, υπόλοιπα = νησίδες)
 * με region-specific loop clipper. `null` όταν δεν υπάρχουν loops → ο caller κάνει
 * bbox-cull· `[]` όταν το εξωτερικό loop αδειάζει (τελείως έξω από την περιοχή).
 */
export function clipHatchLoops(
  e: HatchEntity,
  clipLoop: (loop: Point2D[]) => Point2D[],
): Entity[] | null {
  const paths = e.boundaryPaths ?? [];
  if (paths.length === 0) return null;
  const outer = clipLoop(paths[0]);
  if (outer.length < 3) return [];
  const islands = paths.slice(1).map(clipLoop).filter((loop) => loop.length >= 3);
  return [{ ...e, boundaryPaths: [outer, ...islands] } as Entity];
}

/**
 * All-or-nothing bbox cull (BIM δομικά + block/dimension/leader): κρατιέται ολόκληρο
 * όταν το render-bbox περνά το `overlaps`, αφαιρείται όταν είναι τελείως έξω. Μη
 * μετρήσιμο (zero-area sentinel bounds) → κρατιέται συντηρητικά (δεν σβήνουμε ό,τι
 * δεν μπορούμε να εντοπίσουμε).
 */
export function bboxCullEntity(
  e: Entity,
  overlaps: (b: SpatialBounds) => boolean,
): Entity[] {
  const b = getEntityRenderBounds(e);
  if (b.minX === b.maxX && b.minY === b.maxY) return [e];
  return overlaps(b) ? [e] : [];
}
