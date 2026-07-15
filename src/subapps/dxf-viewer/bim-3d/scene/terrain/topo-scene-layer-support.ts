/**
 * topo-scene-layer-support — shared lifecycle scaffold for the topographic 3D scene layers
 * (ADR-650, N.18 anti-clone). `TerrainSceneLayer` (surface mesh) and `TerrainContourLayer`
 * (draped contour lines) are structural siblings: both are `ThreeJsSceneManager`-owned scene
 * layers that seat a root a hair below internal z=0 and react to the SAME survey / visibility /
 * geo-reference stores with zero React state (ADR-040). This module owns the two pieces that were
 * byte-identical between them, so there is ONE place to change the drop margin or the shared
 * subscription set.
 *
 * @module bim-3d/scene/terrain/topo-scene-layer-support
 */

import * as THREE from 'three';
import { subscribeTopo } from '../../../systems/topography/TopoPointStore';
import { subscribeTerrain3D } from '../../../systems/topography/terrain-3d-store';
import { subscribeGeoReference } from '../../../systems/geo-referencing/geo-reference-store';
import { TERRAIN_DISPLAY_DROP_MM } from '../../../systems/topography/vertical-datum';

/** A store subscription: register `cb`, get back an unsubscribe. */
type LayerSubscribe = (cb: () => void) => () => void;

/**
 * Name a topo scene-layer root, sit it a hair BELOW internal z=0 (so the ground-floor plan/images
 * at z=0 win from above — «κάτοψη πάνω, έδαφος κάτω») and attach it to the scene. Constant
 * world-space drop of the whole layer (ADR-650 M10d).
 */
export function seatTopoLayerRoot(root: THREE.Group, scene: THREE.Object3D, name: string): void {
  root.name = name;
  root.position.y = -TERRAIN_DISPLAY_DROP_MM / 1000;
  scene.add(root);
}

/**
 * Wire the subscriptions every topo scene-layer shares — survey edit (re-triangulation), 3D
 * visibility, and the geo-reference «κούμπωμα» that seats the hill under the building (ADR-650
 * M10b) — plus any layer-specific `extra` subscribers (cut-fill reference level / contour config),
 * inserted in their original position between visibility and geo-reference. Every subscription
 * fires the same `rebuild`. Returns the unsubscribe handles in subscription order.
 */
export function subscribeTopoLayer(
  rebuild: () => void,
  extra: readonly LayerSubscribe[],
): (() => void)[] {
  return [
    subscribeTopo(rebuild),
    subscribeTerrain3D(rebuild),
    ...extra.map((subscribe) => subscribe(rebuild)),
    subscribeGeoReference(rebuild),
  ];
}
