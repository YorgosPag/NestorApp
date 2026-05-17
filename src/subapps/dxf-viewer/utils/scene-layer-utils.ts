/**
 * Scene layer utilities — ADR-358 Phase 9E compat bridge.
 *
 * `getSceneLayerByName` provides a stable call-site for name-keyed lookups
 * while `SceneModel.layers` is still present (Phases 9E-1 → 9E-5).
 * Phase 9E-6e removes `SceneModel.layers` and collapses the implementation.
 *
 * `getLayersByIdMap` is the migration helper for 9E-6b/c consumers:
 * returns the id-keyed map (guaranteed post-9E-5; runtime-rebuilt for legacy scenes).
 */

import type { SceneModel, SceneLayer, LayerId } from '../types/entities';

/**
 * Returns the id-keyed layer map for the scene.
 * Post-9E-5: `layersById` is always present on builder/ops output.
 * Legacy Firestore scenes (no `layersById`): falls back to O(N) rebuild from `layers`.
 * ADR-358 Phase 9E-6b/c — use this helper when migrating from `scene.layers` accesses.
 */
export function getLayersByIdMap(scene: SceneModel): Record<LayerId, SceneLayer> {
  if (scene.layersById) return scene.layersById;
  return Object.fromEntries(Object.values(scene.layers).map((l) => [l.id, l]));
}

/**
 * Look up a SceneLayer by stable LayerId.
 * Post-9E-5: O(1) direct lookup via `layersById`; O(N) rebuild only for legacy scenes.
 */
export function getSceneLayerById(
  scene: SceneModel,
  id: LayerId,
): SceneLayer | undefined {
  return getLayersByIdMap(scene)[id];
}

/**
 * Look up a SceneLayer by display name from the name-keyed map.
 * Returns `undefined` if the layer doesn't exist.
 *
 * @deprecated Use `scene.layersById[entity.layerId]` for new code (ADR-358 §9E).
 * Call-site is stable for Phase 9E-6e implementation swap (no call-site churn needed).
 */
export function getSceneLayerByName(
  scene: SceneModel,
  name: string,
): SceneLayer | undefined {
  return scene.layers[name];
}
