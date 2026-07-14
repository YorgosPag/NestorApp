/**
 * ADR-650 Milestone 1 — ensure the three contour layers exist in a scene.
 *
 * Contour entities render/select/export by `layerId`, so their layers must live in
 * `SceneModel.layersById` before `completeEntity` runs. This looks them up by their
 * canonical names (config), creates any that are missing via the `createSceneLayer`
 * SSoT (auto-mints `lyr_<UUID-v4>`), commits the scene once, and returns the ids.
 */

import type { SceneModel } from '../../types/scene';
import type { LineweightMm, SceneLayer } from '../../types/scene-types';
import { createSceneLayer } from '../../types/scene-types';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';
import type { ContourLayerIds } from './topo-to-entities';
import {
  TOPO_MAJOR_LAYER_NAME, TOPO_MINOR_LAYER_NAME, TOPO_LABEL_LAYER_NAME,
  TOPO_MAJOR_COLOR, TOPO_MINOR_COLOR, TOPO_LABEL_COLOR,
  TOPO_MAJOR_LINEWEIGHT_MM, TOPO_MINOR_LINEWEIGHT_MM,
} from './contour-config';

interface LayerSpec {
  readonly name: string;
  readonly color: string;
  /** ADR-656 M9 — index/intermediate lineweight (mm); labels stay default. */
  readonly lineweight?: LineweightMm;
}

const LAYER_SPECS: readonly LayerSpec[] = [
  { name: TOPO_MAJOR_LAYER_NAME, color: TOPO_MAJOR_COLOR, lineweight: TOPO_MAJOR_LINEWEIGHT_MM },
  { name: TOPO_MINOR_LAYER_NAME, color: TOPO_MINOR_COLOR, lineweight: TOPO_MINOR_LINEWEIGHT_MM },
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
 * ADR-656 M9 — bring an EXISTING contour layer up to the current spec lineweight
 * WITHOUT clobbering a user's manual override: a concrete (user-set) weight is
 * left untouched; only a sentinel (undefined / DEFAULT / ByLayer / ByBlock) is
 * upgraded to the spec value. Idempotent — returns the same reference unchanged.
 */
function reconcileLineweight(layer: SceneLayer, spec: LayerSpec): SceneLayer {
  if (spec.lineweight === undefined) return layer;
  if (isConcreteLineweight(layer.lineweight)) return layer; // respect user override
  if (layer.lineweight === spec.lineweight) return layer;
  return { ...layer, lineweight: spec.lineweight };
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
  let changed = false;

  for (const spec of LAYER_SPECS) {
    const existing = findByName(scene, spec.name);
    if (existing) {
      const upgraded = reconcileLineweight(existing, spec);
      if (upgraded !== existing) {
        layersById[upgraded.id] = upgraded;
        changed = true;
      }
      idByName[spec.name] = existing.id;
      continue;
    }
    const layer = createSceneLayer({
      name: spec.name, color: spec.color, lineweight: spec.lineweight, visible: true, locked: false,
    });
    layersById[layer.id] = layer;
    idByName[spec.name] = layer.id;
    changed = true;
  }

  if (changed) setScene(levelId, { ...scene, layersById });

  return {
    major: idByName[TOPO_MAJOR_LAYER_NAME],
    minor: idByName[TOPO_MINOR_LAYER_NAME],
    label: idByName[TOPO_LABEL_LAYER_NAME],
  };
}
