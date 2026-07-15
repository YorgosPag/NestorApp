/**
 * ADR-656 — ensure ONE named layer exists in a scene (idempotent single-layer mint SSoT).
 *
 * The shared kernel behind `ensure-grid-layers` (M11) and `ensure-north-layer` (M12): both baked
 * topographic overlays need exactly one structural DXF layer to exist in `SceneModel.layersById`
 * before `completeEntities` runs. Look it up by its canonical name, create it via the
 * `createSceneLayer` SSoT if missing, commit the scene once, and return its id. Idempotent — a
 * second call finds it and writes nothing. (The multi-layer M9/M10 ensurers keep their own shape.)
 */

import type { SceneModel } from '../../types/scene';
import type { SceneLayer } from '../../types/scene-types';
import { createSceneLayer } from '../../types/scene-types';

/** Find an existing layer by name in a scene's id-keyed map. */
function findByName(scene: SceneModel, name: string): SceneLayer | undefined {
  for (const layer of Object.values(scene.layersById)) {
    if (layer.name === name) return layer;
  }
  return undefined;
}

/**
 * Ensure the named layer exists in the level's scene; create it (with `color`) if missing and
 * commit once. Returns its layer id, or `null` when the level has no scene.
 */
export function ensureTopoLayer(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
  name: string,
  color: string,
): string | null {
  const scene = getScene(levelId);
  if (!scene) return null;

  const existing = findByName(scene, name);
  if (existing) return existing.id;

  const layer = createSceneLayer({ name, color, visible: true, locked: false });
  setScene(levelId, { ...scene, layersById: { ...scene.layersById, [layer.id]: layer } });
  return layer.id;
}
