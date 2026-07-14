/**
 * ADR-656 M10 — ensure the four survey-point-label layers exist in a scene.
 *
 * Label entities render/select/export by `layerId`, so their layers must live in
 * `SceneModel.layersById` before `completeEntity` runs. This mirrors `ensure-contour-layers`
 * (M9): look each layer up by its canonical name (config), create the missing ones via the
 * `createSceneLayer` SSoT, commit the scene once, and return the ids. Idempotent — a second
 * call finds them all and writes nothing. No lineweight (text/point labels stay default).
 */

import type { SceneModel } from '../../types/scene';
import { ensureLayersByName, type EnsureLayerSpec } from './ensure-scene-layers';
import type { PointLabelLayerIds } from './topo-point-labels';
import {
  TOPO_POINT_ELEV_LAYER_NAME, TOPO_POINT_CODE_LAYER_NAME,
  TOPO_POINT_NUM_LAYER_NAME, TOPO_BOUNDARY_XY_LAYER_NAME,
  TOPO_POINT_ELEV_COLOR, TOPO_POINT_CODE_COLOR,
  TOPO_POINT_NUM_COLOR, TOPO_BOUNDARY_XY_COLOR,
} from './topo-point-label-config';

const LAYER_SPECS: readonly EnsureLayerSpec[] = [
  { name: TOPO_POINT_ELEV_LAYER_NAME, color: TOPO_POINT_ELEV_COLOR },
  { name: TOPO_POINT_CODE_LAYER_NAME, color: TOPO_POINT_CODE_COLOR },
  { name: TOPO_POINT_NUM_LAYER_NAME, color: TOPO_POINT_NUM_COLOR },
  { name: TOPO_BOUNDARY_XY_LAYER_NAME, color: TOPO_BOUNDARY_XY_COLOR },
];

/**
 * Ensure the four point-label layers exist in the level's scene; create the missing ones
 * and commit once. Returns their layer ids.
 */
export function ensurePointLabelLayers(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
): PointLabelLayerIds | null {
  const idByName = ensureLayersByName(getScene, setScene, levelId, LAYER_SPECS);
  if (!idByName) return null;

  return {
    elevation: idByName[TOPO_POINT_ELEV_LAYER_NAME],
    code: idByName[TOPO_POINT_CODE_LAYER_NAME],
    number: idByName[TOPO_POINT_NUM_LAYER_NAME],
    boundary: idByName[TOPO_BOUNDARY_XY_LAYER_NAME],
  };
}
