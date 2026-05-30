/**
 * ADR-395 G6 — wall net-BOQ geometry feed (SSoT).
 *
 * Extracted from `useWallPersistence` (CHECK 4 / N.7.1 file-size split). Builds
 * the BOQ-feed entity for a wall with net area = gross − Σ(opening face area).
 * Scene/Firestore wall geometry stays gross (display/grips/3D untouched); only
 * the BOQ payload carries the net area. Mirror of `slab-boq-feed`.
 */

import type { SceneModel } from '../../types/entities';
import { isBeamEntity, isSlabEntity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import {
  computeWallGeometry,
  type OpeningFootprintForDeduction,
} from '../../bim/geometry/wall-geometry';
import {
  resolveWallTopProfile,
  type WallTopProfile,
} from '../../bim/geometry/wall-top-profile';
import {
  buildWallHostInputs,
  makeWallTopContext,
} from '../../bim/geometry/wall-host-plan-builder';
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
 * ADR-401 B3a — top profile για `attached` τοίχο (μεταβλητή κορυφή κάτω από
 * δοκάρι/πλάκα). Χτίζει per-wall `resolveHost` από τα beams+slabs της σκηνής
 * (ίδιο plan space = `*.params`, mirror του `section-scene-sync`) και αποτιμά
 * τον resolver SSoT. `floorElevationMm = 0`: το active level scene είναι
 * floor-relative (datum ορόφου = 0), όπως το 2D section. Μη-attached → null.
 */
function resolveAttachedWallProfile(
  entity: WallEntity,
  scene: SceneModel | null,
): WallTopProfile | null {
  if (entity.params.topBinding !== 'attached' || !scene) return null;
  const hostInputs = buildWallHostInputs(
    scene.entities.filter(isBeamEntity),
    scene.entities.filter(isSlabEntity),
  );
  const ctx = makeWallTopContext(
    { x: entity.params.start.x, y: entity.params.start.y },
    { x: entity.params.end.x, y: entity.params.end.y },
    hostInputs,
    { floorElevationMm: 0 },
  );
  return resolveWallTopProfile(entity.params, ctx);
}

/**
 * Build the BOQ-feed entity for a wall with net geometry (gross − openings).
 * Geometry recomputed when openings exist **or** the wall is `attached`
 * (ADR-401 B3a — profile-aware gross area/volume)· otherwise reuse the entity's
 * own (gross/flat) geometry.
 */
export function wallBoqEntity(entity: WallEntity, scene: SceneModel | null): BimEntityForBoq {
  const openings = collectWallOpenings(scene, entity.id);
  const profile = resolveAttachedWallProfile(entity, scene);
  const geometry = openings.length > 0 || profile !== null
    ? computeWallGeometry(entity.params, entity.kind, openings, profile ?? undefined)
    : entity.geometry;
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>,
    geometry,
  };
}
