/**
 * furniture-to-three — mesh-based furniture → THREE.Object3D (ADR-410).
 *
 * Thin consumer of the entity-agnostic `meshToObject3D` SSoT (ADR-411): maps a
 * `FurnitureEntity` onto a `MeshPlacement` (category `'furniture'`, vertical
 * anchor `'base'` — furniture rests on the floor) and delegates. All mesh
 * loading / caching / placeholder / units-safety lives in the generic converter.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import type * as THREE from 'three';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import { meshToObject3D } from './mesh-to-object3d';

/** BIM category → Storage library folder for furniture meshes. */
const FURNITURE_MESH_CATEGORY = 'furniture';

/**
 * Build the 3D representation of a furniture entity. Returns a placed glTF clone
 * on a cache hit, or a bbox placeholder on a miss (and kicks off the async load).
 * Returns null only for a degenerate entity.
 */
export function furnitureToObject3D(
  furniture: FurnitureEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Object3D | null {
  const { params } = furniture;
  if (!params) return null;

  return meshToObject3D({
    category: FURNITURE_MESH_CATEGORY,
    assetId: params.assetId,
    bimId: furniture.id,
    bimType: 'furniture',
    matId: params.material ?? 'elem-furniture',
    position: params.position,
    rotationDeg: params.rotationDeg,
    scale: params.scaleOverride ?? 1,
    widthMm: params.widthMm,
    depthMm: params.depthMm,
    heightMm: params.heightMm,
    sceneUnits: params.sceneUnits ?? 'mm',
    floorElevationMm,
    mountingElevationMm: params.mountingElevationMm,
    verticalAnchor: 'base',
    buildingBaseElevationM,
    levelId,
  });
}
