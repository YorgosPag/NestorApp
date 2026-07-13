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
import { TOPO_MAJOR_LAYER_NAME, TOPO_MINOR_LAYER_NAME } from './contour-config';

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
