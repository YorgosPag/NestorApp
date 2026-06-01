/**
 * ADR-401 Phase G.2 — scene → stair host resolver (δοκάρια/πλάκες ορόφου).
 *
 * Εξήχθη από το `use-stair-persistence` (N.7.1 file-size split). Καθαρή SSoT
 * γέφυρα `SceneModel` → host resolver που τρώει ο `resolveEffectiveStairParams`.
 * ΙΔΙΟ idiom με `column-boq-feed` (`buildWallHostInputs` + host resolver) — ο
 * filter beams/slabs ζει σε ΕΝΑ τόπο για τη σκάλα.
 *
 * @see bim/geometry/stair-vertical-profile.ts — ο resolver που το καταναλώνει
 */

import type { SceneModel } from '../../../types/entities';
import { isBeamEntity, isSlabEntity } from '../../../types/entities';
import { buildWallHostInputs, type HostFootprintInput } from '../wall-host-plan-builder';
import { makeStairHostResolver } from '../stair-vertical-profile';

/**
 * Host resolver (δοκάρια + πλάκες της σκηνής) για profile-aware stair attach.
 * `null` scene → `undefined` (nominal, fast path).
 */
export function makeStairHostResolverFromScene(
  scene: SceneModel | null,
): ((id: string) => HostFootprintInput | null) | undefined {
  if (!scene) return undefined;
  return makeStairHostResolver(
    buildWallHostInputs(scene.entities.filter(isBeamEntity), scene.entities.filter(isSlabEntity)),
  );
}
