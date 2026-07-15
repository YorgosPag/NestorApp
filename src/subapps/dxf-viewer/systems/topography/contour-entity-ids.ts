/**
 * ADR-650 M3 — resolve which scene entities are «smoothable» plan-view contours.
 *
 * The exact↔smooth toggle must restyle the contour polylines (major + minor) but
 * NOT their elevation-label texts. Contours are plain `lwpolyline` entities on the
 * canonical TOPO-CONTOUR-MAJOR / -MINOR layers, so we resolve those layer ids by
 * their (structural) names and return the lwpolyline entity ids sitting on them.
 *
 * Topo-domain logic lives here (not in the generic renderer or the command) so the
 * renderer stays layer-agnostic and the command stays a pure batch writer.
 */

import type { SceneModel } from '../../types/scene';
import type { SceneLayer } from '../../types/entities';
import { TOPO_MAJOR_LAYER_NAME, TOPO_MINOR_LAYER_NAME, TOPO_LABEL_LAYER_NAME } from './contour-config';

/**
 * ADR-650 M10d — the three canonical layer names a plan-view contour (line OR label) lives on.
 * The single membership test both the 2D `collectSmoothableContourIds` (lines only) and the 3D
 * overlay skip (`isTopoContourEntity`, lines + labels) derive from — so «what is a contour» has
 * one home, not two drifting name lists.
 */
const TOPO_CONTOUR_LAYER_NAMES: ReadonlySet<string> = new Set([
  TOPO_MAJOR_LAYER_NAME, TOPO_MINOR_LAYER_NAME, TOPO_LABEL_LAYER_NAME,
]);

/**
 * ADR-650 M10d — is this entity a plan-view topo contour (polyline OR elevation label)?
 *
 * Used to keep the contours OUT of the per-floor 3D DXF overlay: they must render exactly ONCE,
 * draped on the surface at their real (datum-shifted) elevation via `TerrainContourLayer`, not
 * re-stamped flat at every floor's elevation (which stacked identical contours per storey). The
 * 2D plan keeps them as ordinary CAD entities — this predicate only gates the 3D overlay.
 */
export function isTopoContourEntity(
  entity: { readonly layerId?: string },
  layersById: Record<string, SceneLayer> | undefined,
): boolean {
  if (!entity.layerId || !layersById) return false;
  const layer = layersById[entity.layerId];
  return !!layer && TOPO_CONTOUR_LAYER_NAMES.has(layer.name);
}

/** Entity ids of the major+minor contour lwpolylines in a scene (labels excluded). */
export function collectSmoothableContourIds(scene: SceneModel): string[] {
  const contourLayerIds = new Set<string>();
  for (const layer of Object.values(scene.layersById)) {
    if (layer.name === TOPO_MAJOR_LAYER_NAME || layer.name === TOPO_MINOR_LAYER_NAME) {
      contourLayerIds.add(layer.id);
    }
  }
  if (contourLayerIds.size === 0) return [];

  const ids: string[] = [];
  for (const entity of scene.entities) {
    if (entity.type === 'lwpolyline' && entity.layerId && contourLayerIds.has(entity.layerId)) {
      ids.push(entity.id);
    }
  }
  return ids;
}
