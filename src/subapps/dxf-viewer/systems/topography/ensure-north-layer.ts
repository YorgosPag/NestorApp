/**
 * ADR-656 M12 — ensure the TOPO-NORTH layer exists in a scene.
 *
 * The baked north-arrow entities render/select/export by `layerId`, so the layer must live in
 * `SceneModel.layersById` before `completeEntities` runs. Delegates to the single-layer mint SSoT
 * `ensureTopoLayer` (shared with M11's grid layer) — idempotent, one commit, returns the id.
 */

import type { SceneModel } from '../../types/scene';
import { ensureTopoLayer } from './ensure-topo-layer';
import { TOPO_NORTH_LAYER_NAME, TOPO_NORTH_COLOR } from './north-arrow-config';

/**
 * Ensure the TOPO-NORTH layer exists in the level's scene; create it if missing and commit once.
 * Returns its layer id, or `null` when the level has no scene.
 */
export function ensureNorthLayer(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
): string | null {
  return ensureTopoLayer(getScene, setScene, levelId, TOPO_NORTH_LAYER_NAME, TOPO_NORTH_COLOR);
}
