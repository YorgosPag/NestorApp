/**
 * ADR-656 M12 — ensure the TOPO-NORTH layer exists in a scene.
 *
 * The baked north-arrow entities render/select/export by `layerId`, so the layer must live in
 * `SceneModel.layersById` before `completeEntities` runs. Mirrors `ensure-grid-layers` (M11):
 * look the layer up by its canonical name (config), create it via the `createSceneLayer` SSoT if
 * missing, commit the scene once, and return its id. Idempotent — a second call writes nothing.
 */

import type { SceneModel } from '../../types/scene';
import type { SceneLayer } from '../../types/scene-types';
import { createSceneLayer } from '../../types/scene-types';
import { TOPO_NORTH_LAYER_NAME, TOPO_NORTH_COLOR } from './north-arrow-config';

/** Find an existing layer by name in a scene's id-keyed map. */
function findByName(scene: SceneModel, name: string): SceneLayer | undefined {
  for (const layer of Object.values(scene.layersById)) {
    if (layer.name === name) return layer;
  }
  return undefined;
}

/**
 * Ensure the TOPO-NORTH layer exists in the level's scene; create it if missing and commit once.
 * Returns its layer id, or `null` when the level has no scene.
 */
export function ensureNorthLayer(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
): string | null {
  const scene = getScene(levelId);
  if (!scene) return null;

  const existing = findByName(scene, TOPO_NORTH_LAYER_NAME);
  if (existing) return existing.id;

  const layer = createSceneLayer({
    name: TOPO_NORTH_LAYER_NAME, color: TOPO_NORTH_COLOR, visible: true, locked: false,
  });
  setScene(levelId, { ...scene, layersById: { ...scene.layersById, [layer.id]: layer } });
  return layer.id;
}
