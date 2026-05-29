/**
 * ADR-395 G6 — wall net-BOQ geometry feed (SSoT).
 *
 * Extracted from `useWallPersistence` (CHECK 4 / N.7.1 file-size split). Builds
 * the BOQ-feed entity for a wall with net area = gross − Σ(opening face area).
 * Scene/Firestore wall geometry stays gross (display/grips/3D untouched); only
 * the BOQ payload carries the net area. Mirror of `slab-boq-feed`.
 */

import type { SceneModel } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import {
  computeWallGeometry,
  type OpeningFootprintForDeduction,
} from '../../bim/geometry/wall-geometry';
import type { BimEntityForBoq } from '../../bim/services/BimToBoqBridge';

/**
 * Collect the host wall's openings from the in-memory scene for net-area
 * subtraction. No Firestore query — openings already hydrated in the active
 * level scene.
 */
function collectWallOpenings(
  scene: SceneModel | null,
  wallId: string,
): OpeningFootprintForDeduction[] {
  if (!scene) return [];
  const result: OpeningFootprintForDeduction[] = [];
  for (const e of scene.entities) {
    if ((e as { type?: string }).type !== 'opening') continue;
    const op = e as OpeningEntity;
    if (op.params?.wallId === wallId && op.params.width > 0 && op.params.height > 0) {
      result.push({ width: op.params.width, height: op.params.height });
    }
  }
  return result;
}

/**
 * Build the BOQ-feed entity for a wall with net geometry (gross − openings).
 * Geometry recomputed only when openings exist; otherwise reuse the entity's
 * own (gross) geometry.
 */
export function wallBoqEntity(entity: WallEntity, scene: SceneModel | null): BimEntityForBoq {
  const openings = collectWallOpenings(scene, entity.id);
  const geometry = openings.length > 0
    ? computeWallGeometry(entity.params, entity.kind, openings)
    : entity.geometry;
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>,
    geometry,
  };
}
