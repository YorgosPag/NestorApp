/**
 * ADR-401 Phase F.2 — column profile-aware BOQ geometry feed (SSoT).
 *
 * Mirror του `wall-boq-feed.ts`. Μια `attached` κολώνα (κορυφή/βάση κολλά σε
 * δοκάρι/πλάκα) έχει **μεταβλητό ύψος** (per-corner lower/upper-envelope) → το
 * BOQ ύψος/όγκος πρέπει να βγαίνει από τα profiles, όχι από το flat
 * `params.height`. Χτίζει per-column host context από τα beams+slabs της σκηνής
 * (ίδιο plan space, reuse `buildWallHostInputs`/`makeColumnHostResolver`) και
 * αποτιμά τους resolvers SSoT. Μη-attached κολώνα → reuse του flat geometry.
 *
 * `floorElevationMm = 0`: το active level scene είναι floor-relative (datum
 * ορόφου = 0), ίδια σύμβαση με τον wall BOQ feed + το 2D section.
 */

import type { SceneModel } from '../../types/entities';
import { isBeamEntity, isSlabEntity } from '../../types/entities';
import type { ColumnEntity } from '../../bim/types/column-types';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import {
  resolveColumnTopProfile,
  resolveColumnBaseProfile,
  makeColumnHostResolver,
  type ColumnTopProfile,
  type ColumnBaseProfile,
} from '../../bim/geometry/column-vertical-profile';
import { buildWallHostInputs } from '../../bim/geometry/wall-host-plan-builder';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import type { BimEntityForBoq } from '../../bim/services/BimToBoqBridge';
import { computeColumnFinishContribution } from '../../bim/finishes/structural-finish-scene';

/**
 * ADR-401 F.2 — top + base profiles για `attached` κολώνα (per-corner envelope
 * κάτω από δοκάρι/πλάκα ΚΑΙ πάνω σε θεμέλιο/δοκάρι). Footprint coverage στο ίδιο
 * plan space με τους hosts (`entity.geometry.footprint.vertices`). Κάθε προφίλ →
 * null όταν δεν είναι `attached`.
 */
function resolveAttachedColumnProfiles(
  entity: ColumnEntity,
  scene: SceneModel | null,
): { top: ColumnTopProfile | null; base: ColumnBaseProfile | null } {
  if (!scene) return { top: null, base: null };
  const topAttached = entity.params.topBinding === 'attached';
  const baseAttached = entity.params.baseBinding === 'attached';
  if (!topAttached && !baseAttached) return { top: null, base: null };

  const resolveHostInput = makeColumnHostResolver(
    buildWallHostInputs(scene.entities.filter(isBeamEntity), scene.entities.filter(isSlabEntity)),
  );
  const footprint = projectVerticesTo2D(entity.geometry.footprint.vertices);
  const ctx = { floorElevationMm: 0, resolveHostInput };
  const top = topAttached ? resolveColumnTopProfile(entity.params, footprint, ctx) : null;
  const base = baseAttached ? resolveColumnBaseProfile(entity.params, footprint, ctx) : null;
  return { top, base };
}

/**
 * Build το BOQ-feed entity μιας κολώνας με profile-aware geometry όταν είναι
 * `attached` (ύψος/όγκος από top − base)· αλλιώς reuse του (flat) geometry.
 * Mirror του `wallBoqEntity`.
 */
export function columnBoqEntity(entity: ColumnEntity, scene: SceneModel | null): BimEntityForBoq {
  const { top, base } = resolveAttachedColumnProfiles(entity, scene);
  const geometry = top !== null || base !== null
    ? computeColumnGeometry(entity.params, top ?? undefined, base ?? undefined)
    : entity.geometry;
  // ADR-449 — derived σοβάς contribution (interior/exterior εμβαδά, εξαιρώντας
  // καλυμμένα από τοίχους). `undefined` όταν σοβάς ανενεργός → single-entry path.
  const finishContribution = computeColumnFinishContribution(entity, geometry, scene);
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>,
    geometry,
    ...(finishContribution ? { finishContribution } : {}),
  };
}
