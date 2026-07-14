/**
 * ADR-656 M11 — ensure the TOPO-GRID layer exists in a scene.
 *
 * The baked grid entities render/select/export by `layerId`, so the layer must live in
 * `SceneModel.layersById` before `completeEntities` runs. Same contract as contours (M9)
 * and point labels (M10) — one layer instead of several — so it runs on the same
 * `ensureLayersByName` engine rather than a hand-rolled copy of it.
 */

import type { SceneModel } from '../../types/scene';
import { ensureLayersByName, type EnsureLayerSpec } from './ensure-scene-layers';
import { TOPO_GRID_LAYER_NAME, TOPO_GRID_COLOR } from './topo-grid-config';

const LAYER_SPECS: readonly EnsureLayerSpec[] = [
  { name: TOPO_GRID_LAYER_NAME, color: TOPO_GRID_COLOR },
];

/**
 * Ensure the TOPO-GRID layer exists in the level's scene; create it if missing and commit once.
 * Returns its layer id, or `null` when the level has no scene.
 */
export function ensureGridLayer(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
): string | null {
  const idByName = ensureLayersByName(getScene, setScene, levelId, LAYER_SPECS);
  return idByName ? idByName[TOPO_GRID_LAYER_NAME] : null;
}
