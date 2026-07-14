/**
 * ADR-656 — SSoT for "make sure these named layers exist in the level's scene".
 *
 * Contours (M9), point labels (M10) and the grid (M11) all need the same thing before their
 * entities can be committed: their layers must live in `SceneModel.layersById`, looked up by
 * canonical *name* (the id is generated). Each module had grown its own copy of the same
 * scan → create-if-missing → commit-once loop, which is exactly the sibling-twin pattern
 * N.18 forbids. One engine owns it; the callers only declare their specs and map the
 * returned ids onto their own shape.
 *
 * Idempotent by construction: a second call finds every layer and writes nothing
 * (`setScene` is only called when something actually changed).
 */

import type { SceneModel } from '../../types/scene';
import type { LineweightMm, SceneLayer } from '../../types/scene-types';
import { createSceneLayer } from '../../types/scene-types';

/** Declarative description of a layer the caller needs to exist. */
export interface EnsureLayerSpec {
  readonly name: string;
  readonly color: string;
  /** Omitted for text/point layers, which stay at the scene default. */
  readonly lineweight?: LineweightMm;
}

/**
 * Hook applied to a layer that ALREADY exists. Return the layer unchanged to leave it
 * alone, or a new object to upgrade it. Contours use this to bring a stale lineweight up
 * to spec without clobbering a user's manual override; the other callers pass nothing.
 */
export type ReconcileExisting = (existing: SceneLayer, spec: EnsureLayerSpec) => SceneLayer;

/** Find an existing layer by name in a scene's id-keyed map. */
export function findLayerByName(scene: SceneModel, name: string): SceneLayer | undefined {
  for (const layer of Object.values(scene.layersById)) {
    if (layer.name === name) return layer;
  }
  return undefined;
}

/**
 * Ensure every spec'd layer exists in the level's scene; create the missing ones and commit
 * the scene at most once. Returns an id-by-name map, or `null` when the level has no scene.
 */
export function ensureLayersByName(
  getScene: (levelId: string) => SceneModel | null,
  setScene: (levelId: string, scene: SceneModel) => void,
  levelId: string,
  specs: readonly EnsureLayerSpec[],
  reconcile?: ReconcileExisting,
): Record<string, string> | null {
  const scene = getScene(levelId);
  if (!scene) return null;

  const layersById = { ...scene.layersById };
  const idByName: Record<string, string> = {};
  let changed = false;

  for (const spec of specs) {
    const existing = findLayerByName(scene, spec.name);
    if (existing) {
      const upgraded = reconcile ? reconcile(existing, spec) : existing;
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

  return idByName;
}
