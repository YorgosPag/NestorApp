/**
 * Scene layer utilities — ADR-358 Phase 9E-6e.
 * `SceneModel.layers` (name-keyed) dropped. All lookups use `layersById`.
 */

import type { SceneModel, SceneLayer, LayerId } from '../types/entities';

/**
 * Returns the id-keyed layer map for the scene.
 * ADR-358 Phase 9E-6e: `layersById` is required on SceneModel — direct return.
 */
export function getLayersByIdMap(scene: SceneModel): Record<LayerId, SceneLayer> {
  return scene.layersById;
}

/**
 * Look up a SceneLayer by stable LayerId. O(1).
 */
export function getSceneLayerById(
  scene: SceneModel,
  id: LayerId,
): SceneLayer | undefined {
  return scene.layersById[id];
}

/**
 * Look up a SceneLayer by display name. O(N) bridge — prefer id-keyed access.
 * ADR-358 Phase 9E-6e: migrated from name-keyed `scene.layers` to linear scan of `layersById`.
 */
export function getSceneLayerByName(
  scene: SceneModel,
  name: string,
): SceneLayer | undefined {
  return Object.values(scene.layersById).find((l) => l.name === name);
}
