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
import {
  buildTopoSurfaceEntity, TOPO_SURFACE_LAYER_NAME, TOPO_SURFACE_COLOR,
} from '../topo-surface-entity';
import { getContourConfig } from '../contour-config-store';
import { getContourDisplayStyle } from '../contour-display-store';
import { getTopoDisplayProjector, projectContourLines } from '../topo-display-frame';
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
  // ADR-662 Φ2β — the topo surface footprint sits on its own structural layer.
  { name: TOPO_SURFACE_LAYER_NAME, color: TOPO_SURFACE_COLOR },
];

/** Resolve (creating if absent) the topo-derived layer ids in a mutable layersById copy. */
function ensureLayers(
  scene: SceneModel,
): { layersById: Record<string, SceneLayer>; ids: ContourLayerIds; surfaceLayerId: string } {
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
    surfaceLayerId: idByName[TOPO_SURFACE_LAYER_NAME],
  };
}

/**
 * Rebuild the plan-view contours for `levelId` from the (already restored) survey stores.
 * Returns the number of contour entities written. A survey with no triangulable ground
 * still runs — it just clears any stale contours (idempotent cleanup) and writes none.
 *
 * Thin get→build→commit wrapper over the PURE {@link rebuildTopoDerivedScene}; the ONE
 * reconciler (ADR-650 §M10g) composes that pure core with the baked-product delta-move so
 * both land in a SINGLE scene write instead of two.
 */
export function regenerateTopoContours(deps: RegenerateTopoDeps): number {
  const scene = deps.getScene(deps.levelId);
  if (!scene) return 0;
  const rebuilt = rebuildTopoDerivedScene(scene);
  deps.commitScene(rebuilt.scene);
  return rebuilt.count;
}

/** The rebuilt scene + how many derived entities it now carries. */
export interface RebuiltTopoDerived {
  readonly scene: SceneModel;
  readonly count: number;
}

/**
 * PURE core of the regenerate: scene in → scene out, zero commits.
 *
 * Extracted (ADR-650 §M10g) so the reconciler can chain «rebuild derived» and «delta-move the
 * baked products» into one commit. Everything about the rebuild is unchanged — it still clears
 * every entity on a topo-derived layer first (idempotent) and seats the fresh ones at the back
 * (ADR-661). The survey stores are still read here: they ARE the source this rebuilds from.
 */
export function rebuildTopoDerivedScene(scene: SceneModel): RebuiltTopoDerived {
  const { layersById, ids, surfaceLayerId } = ensureLayers(scene);
  const topoDerivedLayerIds = new Set<string>([ids.major, ids.minor, ids.label, surfaceLayerId]);

  // Idempotent: drop every existing entity sitting on a topo-derived layer (contours + surface
  // footprint) before rebuilding, so repeated loads / level switches never duplicate them.
  const kept = scene.entities.filter(
    (e) => !(e.layerId !== undefined && topoDerivedLayerIds.has(e.layerId)),
  );

  // Regenerate from the restored survey (Civil 3D: contours + surface are styles over the TIN).
  const surface = getTopoSurface('existing');
  let fresh: Entity[] = [];
  if (surface.triangles.length > 0) {
    const generated = generateContoursFromSurface(surface, getContourConfig());
    // ADR-650 M10 geo-referencing — the survey lives in ΕΓΣΑ WORLD coords; project it
    // into the building's LOCAL frame so the terrain «κάθεται» on the plan near the
    // origin (no ADR-635 culling blowup). Identity/unset → no-op (backward compatible).
    const contours = projectContourLines(generated.contours, getTopoDisplayProjector());
    const contourEntities = buildContourEntities(
      contours, getContourConfig(), ids, getContourDisplayStyle() === 'smooth',
    ) as Entity[];
    // ADR-662 Φ2β — the selectable surface footprint (SAME builder as the interactive
    // producer; already display-frame projected). Seat it FIRST (backmost) so the outline
    // reads BEHIND the contours, which in turn read behind the κάτοψη.
    const surfaceEntity = buildTopoSurfaceEntity('existing', surfaceLayerId);
    fresh = surfaceEntity
      ? [surfaceEntity as unknown as Entity, ...contourEntities]
      : contourEntities;
  }

  // ADR-661 — contours are BACKGROUND context: prepend `fresh` (array front = index 0 = drawn
  // FIRST = behind everything), NOT append. This is the DURABLE send-to-back: the survey is the SSoT
  // and contours are rebuilt here on every load / level-switch / geo-ref change, so any reorder done
  // on the interactive path would be undone here unless this construction site also seats them at the
  // back. `fresh`'s and `kept`'s internal relative order are each preserved. With the array-order
  // render SSoT (ADR-661 DxfRenderer), array position alone puts the κάτοψη on top — no background pass.
  return {
    scene: {
      ...scene,
      layersById,
      entities: [...(fresh as unknown as AnySceneEntity[]), ...kept],
    },
    count: fresh.length,
  };
}
