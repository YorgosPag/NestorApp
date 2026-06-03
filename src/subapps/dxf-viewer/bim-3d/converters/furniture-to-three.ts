/**
 * furniture-to-three — mesh-based furniture → THREE.Object3D (ADR-410).
 *
 * Unlike the parametric converters, the 3D form comes from an external CC0 glTF
 * mesh loaded by `FurnitureGltfCache` (Option A):
 *   - cache HIT  → clone the template Group, place + rotate + scale it.
 *   - cache MISS → return a bounding-box placeholder (widthMm × heightMm × depthMm)
 *     AND fire `preload(assetId)`; when the load resolves the store bump triggers
 *     a resync and the real mesh replaces the placeholder.
 *
 * Units-safe (the `panelToMesh` pattern, NOT the buggy `fixtureToMesh`):
 *   - the glTF mesh geometry is already in METERS (glTF spec) → never re-scaled,
 *     only `scaleOverride` (a user multiplier, default 1) is applied;
 *   - the PLAN placement (`params.position`, scene units) → meters via
 *     `sceneUnitsToMeters`;
 *   - physical mm dimensions (footprint placeholder) → meters via `MM_TO_M`.
 *
 * Coordinate convention (bim-three-shape-helpers header):
 *   DXF plan (mm): X = East, Y = North → Three.js (m, Y-up): x = East, z = -North.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import * as THREE from 'three';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D } from '../materials/MaterialCatalog3D';
import { furnitureGltfCache } from '../library/furniture-gltf-cache';

const MM_TO_M = 0.001;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Build the 3D representation of a furniture entity. Returns a cloned glTF Group
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

  const sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm');
  const worldX = params.position.x * sceneToM;
  const worldZ = -(params.position.y * sceneToM);
  // Base (floor-contact) elevation of the item.
  const baseY = (floorElevationMm + params.mountingElevationMm) * MM_TO_M + buildingBaseElevationM;
  // Plan CCW (+Z) maps to clockwise about world +Y (plan Y → world -Z mirror).
  const rotY = -params.rotationDeg * DEG_TO_RAD;
  const scale = params.scaleOverride ?? 1;

  const cached = furnitureGltfCache.getInstance(params.assetId);
  if (cached) {
    cached.position.set(worldX, baseY, worldZ);
    cached.rotation.y = rotY;
    cached.scale.setScalar(scale);
    tagObject(cached, furniture, levelId);
    return cached;
  }

  // Cache miss → bbox placeholder + start the async load.
  furnitureGltfCache.preload(params.assetId);
  const placeholder = buildPlaceholder(params.widthMm, params.depthMm, params.heightMm, scale);
  // Box is centred on its own origin → lift by half-height so the base sits on baseY.
  placeholder.position.set(worldX, baseY + (params.heightMm * MM_TO_M * scale) / 2, worldZ);
  placeholder.rotation.y = rotY;
  tagObject(placeholder, furniture, levelId);
  return placeholder;
}

/** Bounding-box placeholder mesh (warm wood-tan fallback material). */
function buildPlaceholder(widthMm: number, depthMm: number, heightMm: number, scale: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(
    widthMm * MM_TO_M * scale,
    heightMm * MM_TO_M * scale,
    depthMm * MM_TO_M * scale,
  );
  const mesh = new THREE.Mesh(geo, getElementMaterial3D('furniture'));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Tag the object + all descendant meshes so raycast/selection resolves the entity. */
function tagObject(obj: THREE.Object3D, furniture: FurnitureEntity, levelId?: string): void {
  const matId = furniture.params.material ?? 'elem-furniture';
  obj.userData['bimId'] = furniture.id;
  obj.userData['bimType'] = 'furniture';
  obj.userData['matId'] = matId;
  if (levelId !== undefined) obj.userData['levelId'] = levelId;
  obj.traverse((child) => {
    child.userData['bimId'] = furniture.id;
    child.userData['bimType'] = 'furniture';
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}
