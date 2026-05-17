/**
 * Scene layer utilities — ADR-358 Phase 9E compat bridge.
 *
 * `getSceneLayerByName` provides a stable call-site for name-keyed lookups
 * while `SceneModel.layers` remains name-keyed (Phases 9E-1 → 9E-5).
 * Phase 9E-6 replaces the implementation with an O(1) id-keyed lookup and
 * callers require no further change.
 */

import type { SceneModel, SceneLayer, LayerId } from '../types/entities';

/**
 * Look up a SceneLayer by display name from the scene's name-keyed map.
 * Returns `undefined` if the layer doesn't exist.
 *
 * @deprecated Use `scene.layersById[entity.layerId]` for new code (ADR-358 §9E).
 */
export function getSceneLayerByName(
  scene: SceneModel,
  name: string,
): SceneLayer | undefined {
  return scene.layers[name];
}

/**
 * Look up a SceneLayer by stable LayerId from the scene's id-keyed map.
 * Falls back to iterating `scene.layers` values for legacy scenes without `layersById`.
 */
export function getSceneLayerById(
  scene: SceneModel,
  id: LayerId,
): SceneLayer | undefined {
  if (scene.layersById) return scene.layersById[id];
  return Object.values(scene.layers).find((l) => l.id === id);
}
