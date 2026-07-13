/**
 * ADR-650 Milestone 1 — ensure the three contour layers exist in a scene.
 *
 * Contour entities render/select/export by `layerId`, so their layers must live in
 * `SceneModel.layersById` before `completeEntity` runs. This looks them up by their
 * canonical names (config), creates any that are missing via the `createSceneLayer`
 * SSoT (auto-mints `lyr_<UUID-v4>`), commits the scene once, and returns the ids.
 */

import type { SceneModel } from '../../types/scene';
import type { SceneLayer } from '../../types/scene-types';
import { createSceneLayer } from '../../types/scene-types';
import type { ContourLayerIds } from './topo-to-entities';
import {
  TOPO_MAJOR_LAYER_NAME, TOPO_MINOR_LAYER_NAME, TOPO_LABEL_LAYER_NAME,
  TOPO_MAJOR_COLOR, TOPO_MINOR_COLOR, TOPO_LABEL_COLOR,
} from './contour-config';

interface LayerSpec {
  readonly name: string;
  readonly color: string;
}

const LAYER_SPECS: readonly LayerSpec[] = [
  { name: TOPO_MAJOR_LAYER_NAME, color: TOPO_MAJOR_COLOR },
  { name: TOPO_MINOR_LAYER_NAME, color: TOPO_MINOR_COLOR },
  { name: TOPO_LABEL_LAYER_NAME, color: TOPO_LABEL_COLOR },
];

/** Find an existing layer by name in a scene's id-keyed map. */
function findByName(scene: SceneModel, name: string): SceneLayer | undefined {
  for (const layer of Object.values(scene.layersById)) {
    if (layer.name === name) return layer;
  }
  return undefined;
}

/**
 * Ensure the major/minor/label contour layers exist in the level's scene; create the
 * missing ones and commit once. Returns their layer ids.
 */
export function ensureContourLayers(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
): ContourLayerIds | null {
  const scene = getScene(levelId);
  if (!scene) return null;

  const layersById = { ...scene.layersById };
  const idByName: Record<string, string> = {};
  let created = false;

  for (const spec of LAYER_SPECS) {
    const existing = findByName(scene, spec.name);
    if (existing) {
      idByName[spec.name] = existing.id;
      continue;
    }
    const layer = createSceneLayer({ name: spec.name, color: spec.color, visible: true, locked: false });
    layersById[layer.id] = layer;
    idByName[spec.name] = layer.id;
    created = true;
  }

  if (created) setScene(levelId, { ...scene, layersById });

  return {
    major: idByName[TOPO_MAJOR_LAYER_NAME],
    minor: idByName[TOPO_MINOR_LAYER_NAME],
    label: idByName[TOPO_LABEL_LAYER_NAME],
  };
}
