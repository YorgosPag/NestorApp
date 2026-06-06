/**
 * ADR-395 G6 — wall net-BOQ geometry feed (SSoT).
 *
 * Extracted from `useWallPersistence` (CHECK 4 / N.7.1 file-size split). Builds
 * the BOQ-feed entity for a wall with net area = gross − Σ(opening face area).
 * Scene/Firestore wall geometry stays gross (display/grips/3D untouched); only
 * the BOQ payload carries the net area. Mirror of `slab-boq-feed`.
 */

import type { SceneModel } from '../../types/entities';
import { isBeamEntity, isSlabEntity, isRoofEntity } from '../../types/entities';
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
  resolveWallBaseProfile,
  type WallBaseProfile,
} from '../../bim/geometry/wall-base-profile';
import {
  buildWallHostInputs,
  makeWallTopContext,
  makeWallBaseContext,
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
 * ADR-401 B3a/(γ) — top + base profiles για `attached` τοίχο (μεταβλητή κορυφή
 * κάτω από δοκάρι/πλάκα ΚΑΙ μεταβλητός πάτος πάνω σε θεμέλιο/δοκάρι). Χτίζει
 * per-wall host context από τα beams+slabs της σκηνής (ίδιο plan space =
 * `*.params`, mirror του `section-scene-sync`) και αποτιμά τους resolvers SSoT.
 * `floorElevationMm = 0`: το active level scene είναι floor-relative (datum
 * ορόφου = 0), όπως το 2D section. Κάθε προφίλ → null όταν δεν είναι `attached`.
 */
function resolveAttachedWallProfiles(
  entity: WallEntity,
  scene: SceneModel | null,
): { top: WallTopProfile | null; base: WallBaseProfile | null } {
  if (!scene) return { top: null, base: null };
  const topAttached = entity.params.topBinding === 'attached';
  const baseAttached = entity.params.baseBinding === 'attached';
  if (!topAttached && !baseAttached) return { top: null, base: null };
  const hostInputs = buildWallHostInputs(
    scene.entities.filter(isBeamEntity),
    scene.entities.filter(isSlabEntity),
    scene.entities.filter(isRoofEntity),
  );
  const start = { x: entity.params.start.x, y: entity.params.start.y };
  const end = { x: entity.params.end.x, y: entity.params.end.y };
  const top = topAttached
    ? resolveWallTopProfile(entity.params, makeWallTopContext(start, end, hostInputs, { floorElevationMm: 0 }))
    : null;
  const base = baseAttached
    ? resolveWallBaseProfile(entity.params, makeWallBaseContext(start, end, hostInputs, { floorElevationMm: 0 }))
    : null;
  return { top, base };
}

/**
 * Build the BOQ-feed entity for a wall with net geometry (gross − openings).
 * Geometry recomputed when openings exist **or** the wall is `attached`
 * (ADR-401 B3a/(γ) — profile-aware gross area/volume με top − base)· otherwise
 * reuse the entity's own (gross/flat) geometry.
 */
export function wallBoqEntity(entity: WallEntity, scene: SceneModel | null): BimEntityForBoq {
  const openings = collectWallOpenings(scene, entity.id);
  const { top, base } = resolveAttachedWallProfiles(entity, scene);
  const geometry = openings.length > 0 || top !== null || base !== null
    ? computeWallGeometry(entity.params, entity.kind, openings, top ?? undefined, base ?? undefined)
    : entity.geometry;
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>,
    geometry,
  };
}
