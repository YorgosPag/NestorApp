'use client';

/**
 * ADR-650 — silent regenerate of the DERIVED contour products from the restored
 * survey definition (load path).
 *
 * Big-player model: the survey (points/breaklines/boundary) is the SSoT; the contour
 * lwpolylines + labels are PRODUCTS. On reload we restore the definition into the topo
 * stores, then rebuild the products here — never persisting baked contour geometry.
 *
 * Two invariants separate this from the user's «Generate» button
 * (`useTopoContours.generate`):
 *   1. **Silent** — writes the scene through the caller's `commitScene` with a NON
 *      `local-edit` origin, and does NOT go through `CommandHistory`. So the load
 *      neither pushes an undo entry nor schedules a DXF autosave loop.
 *   2. **Idempotent** — every existing entity on the three TOPO-CONTOUR-* layers is
 *      dropped before the new ones are added, so repeated loads / level switches never
 *      duplicate the contours.
 *
 * @see ../useTopoContours.ts — the interactive (undoable) generate path
 * @see ./useTopoPersistence.ts — the caller (inside `hydrate`)
 */

import type { SceneModel, AnySceneEntity } from '../../../types/scene';
import type { SceneLayer } from '../../../types/scene-types';
import { createSceneLayer } from '../../../types/scene-types';
import type { Entity } from '../../../types/entities';
import { getTopoSurface } from '../topo-surface';
import { generateContoursFromSurface } from '../contour-generator';
import { buildContourEntities, type ContourLayerIds } from '../topo-to-entities';
import { getContourConfig } from '../contour-config-store';
import { getContourDisplayStyle } from '../contour-display-store';
import {
  TOPO_MAJOR_LAYER_NAME, TOPO_MINOR_LAYER_NAME, TOPO_LABEL_LAYER_NAME,
  TOPO_MAJOR_COLOR, TOPO_MINOR_COLOR, TOPO_LABEL_COLOR,
} from '../contour-config';

export interface RegenerateTopoDeps {
  /** Read the current scene of the target level. */
  readonly getScene: (levelId: string) => SceneModel | null;
  /** Write the scene back with a SILENT origin (`system-reconcile`/`load` — no autosave/undo). */
  readonly commitScene: (scene: SceneModel) => void;
  readonly levelId: string;
}

interface LayerSpec { readonly name: string; readonly color: string }
const LAYER_SPECS: readonly LayerSpec[] = [
  { name: TOPO_MAJOR_LAYER_NAME, color: TOPO_MAJOR_COLOR },
  { name: TOPO_MINOR_LAYER_NAME, color: TOPO_MINOR_COLOR },
  { name: TOPO_LABEL_LAYER_NAME, color: TOPO_LABEL_COLOR },
];

/** Resolve (creating if absent) the three contour layer ids in a mutable layersById copy. */
function ensureLayers(scene: SceneModel): { layersById: Record<string, SceneLayer>; ids: ContourLayerIds } {
  const layersById = { ...scene.layersById } as Record<string, SceneLayer>;
  const idByName: Record<string, string> = {};
  for (const spec of LAYER_SPECS) {
    const existing = Object.values(layersById).find((l) => l.name === spec.name);
    if (existing) { idByName[spec.name] = existing.id; continue; }
    const layer = createSceneLayer({ name: spec.name, color: spec.color, visible: true, locked: false });
    layersById[layer.id] = layer;
    idByName[spec.name] = layer.id;
  }
  return {
    layersById,
    ids: {
      major: idByName[TOPO_MAJOR_LAYER_NAME],
      minor: idByName[TOPO_MINOR_LAYER_NAME],
      label: idByName[TOPO_LABEL_LAYER_NAME],
    },
  };
}

/**
 * Rebuild the plan-view contours for `levelId` from the (already restored) survey stores.
 * Returns the number of contour entities written. A survey with no triangulable ground
 * still runs — it just clears any stale contours (idempotent cleanup) and writes none.
 */
export function regenerateTopoContours(deps: RegenerateTopoDeps): number {
  const scene = deps.getScene(deps.levelId);
  if (!scene) return 0;

  const { layersById, ids } = ensureLayers(scene);
  const contourLayerIds = new Set<string>([ids.major, ids.minor, ids.label]);

  // Idempotent: drop every existing entity sitting on a contour layer before rebuilding.
  const kept = scene.entities.filter(
    (e) => !(e.layerId !== undefined && contourLayerIds.has(e.layerId)),
  );

  // Regenerate from the restored survey (Civil 3D: contours are a style over the TIN).
  const surface = getTopoSurface('existing');
  let fresh: Entity[] = [];
  if (surface.triangles.length > 0) {
    const { contours } = generateContoursFromSurface(surface, getContourConfig());
    fresh = buildContourEntities(
      contours, getContourConfig(), ids, getContourDisplayStyle() === 'smooth',
    ) as Entity[];
  }

  deps.commitScene({
    ...scene,
    layersById,
    entities: [...kept, ...(fresh as unknown as AnySceneEntity[])],
  });
  return fresh.length;
}
