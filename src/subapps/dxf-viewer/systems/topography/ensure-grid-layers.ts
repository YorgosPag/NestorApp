/**
 * ADR-656 M11 — ensure the TOPO-GRID layer exists in a scene.
 *
 * The baked grid entities render/select/export by `layerId`, so the layer must live in
 * `SceneModel.layersById` before `completeEntities` runs. Delegates to the single-layer mint SSoT
 * `ensureTopoLayer` (shared with M12's north-arrow layer) — idempotent, one commit, returns the id.
 */

import type { SceneModel } from '../../types/scene';
import { ensureTopoLayer } from './ensure-topo-layer';
import { TOPO_GRID_LAYER_NAME, TOPO_GRID_COLOR } from './topo-grid-config';

/**
 * Ensure the TOPO-GRID layer exists in the level's scene; create it if missing and commit once.
 * Returns its layer id, or `null` when the level has no scene.
 */
export function ensureGridLayer(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
): string | null {
  return ensureTopoLayer(getScene, setScene, levelId, TOPO_GRID_LAYER_NAME, TOPO_GRID_COLOR);
}
