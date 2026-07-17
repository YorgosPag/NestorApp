/**
 * mesh-to-object3d — entity-agnostic mesh-based BIM element → THREE.Object3D
 * (ADR-411, generalised from `furniture-to-three.ts`).
 *
 * The 3D form comes from an external CC0 glTF mesh loaded by `bimMeshCache`
 * (Option A):
 *   - cache HIT  → clone the template Group, place + rotate + scale it.
 *   - cache MISS → return a bounding-box placeholder (widthMm × heightMm × depthMm)
 *     AND fire `preload`; when the load resolves the store bump triggers a resync
 *     and the real mesh replaces the placeholder.
 *
 * Vertical anchor (ADR-411 Δ1):
 *   - `'base'` → the item rests ON the mounting plane (furniture on the floor).
 *   - `'top'`  → the item hangs FROM the mounting plane (a ceiling/pendant light
 *     fixture whose top face sits at the ceiling-relative `mountingElevationMm`).
 * The anchor edge is derived from the cloned group's real bounding box, so the
 * placement is correct regardless of the mesh's local origin.
 *
 * Units-safe (the `panelToMesh` pattern, NOT the buggy `fixtureToMesh`):
 *   - the glTF geometry is already in METERS → never re-scaled, only the user
 *     `scale` multiplier is applied;
 *   - the PLAN placement (`position`, scene units) → meters via `sceneUnitsToMeters`;
 *   - physical mm dimensions (placeholder) → meters via `MM_TO_M`.
 *
 * Coordinate convention: DXF plan (mm) X=East, Y=North → Three.js (m, Y-up)
 * x=East, z=-North.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import * as THREE from 'three';
import { finiteBox3FromObject } from '../scene/finite-bounds';
import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { bimMeshCache } from '../library/bim-mesh-library/bim-mesh-cache';
import { stampBimIdentity } from './bim-three-shape-helpers';

const MM_TO_M = 0.001;
const DEG_TO_RAD = Math.PI / 180;

/** Vertical reference edge of the mesh that lands on the mounting plane. */
export type VerticalAnchor = 'base' | 'top';

/** Placement descriptor for a mesh-based BIM entity (entity-agnostic). */
export interface MeshPlacement {
  /** BIM category → Storage library folder (`bim-mesh-library/<category>/`). */
  readonly category: string;
  /** Catalog asset id (`<assetId>.glb`). */
  readonly assetId: string;
  /** Owning entity id (raycast/selection tag). */
  readonly bimId: string;
  /** Entity `type` string (userData tag). */
  readonly bimType: string;
  /** Material-catalog id for the placeholder + userData tag. */
  readonly matId: string;
  /** Plan insertion point, scene units. */
  readonly position: { readonly x: number; readonly y: number };
  /** Plan rotation about the vertical axis (deg, CCW). */
  readonly rotationDeg: number;
  /** Uniform scale multiplier (default 1). */
  readonly scale: number;
  /** Placeholder bbox dimensions (mm). */
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
  readonly sceneUnits: SceneUnits;
  readonly floorElevationMm: number;
  /** Mounting elevation above the storey FFL (mm). */
  readonly mountingElevationMm: number;
  readonly verticalAnchor: VerticalAnchor;
  readonly buildingBaseElevationM?: number;
  readonly levelId?: string;
}

/**
 * Build the 3D representation of a mesh-based BIM entity. Returns a placed clone
 * on a cache hit, or a bbox placeholder on a miss (and kicks off the async load).
 */
export function meshToObject3D(p: MeshPlacement): THREE.Object3D {
  const sceneToM = sceneUnitsToMeters(p.sceneUnits);
  const worldX = p.position.x * sceneToM;
  const worldZ = -(p.position.y * sceneToM);
  // Mounting plane elevation (storey FFL + mounting offset).
  const mountingY = (p.floorElevationMm + p.mountingElevationMm) * MM_TO_M + (p.buildingBaseElevationM ?? 0);
  // Plan CCW (+Z) maps to clockwise about world +Y (plan Y → world -Z mirror).
  const rotY = -p.rotationDeg * DEG_TO_RAD;
  const scale = p.scale || 1;

  const cached = bimMeshCache.getInstance(p.category, p.assetId);
  if (cached) {
    cached.position.set(worldX, 0, worldZ);
    cached.rotation.y = rotY;
    cached.scale.setScalar(scale);
    cached.updateMatrixWorld(true);
    // Land the anchor edge (base/top) on the mounting plane using the real bbox.
    // An empty group (no meshes) → anchor at origin so position.y === mounting.
    const box = finiteBox3FromObject(cached);
    const anchorY = box ? (p.verticalAnchor === 'top' ? box.max.y : box.min.y) : 0;
    cached.position.y = mountingY - anchorY;
    tagObject(cached, p);
    return cached;
  }

  // Cache miss → bbox placeholder + start the async load.
  bimMeshCache.preload(p.category, p.assetId);
  const heightM = p.heightMm * MM_TO_M * scale;
  const placeholder = buildPlaceholder(p.widthMm, p.depthMm, p.heightMm, scale, p.matId);
  // Box geometry is centred on its own origin → offset by half-height so the
  // chosen anchor edge sits on the mounting plane.
  const halfOffset = p.verticalAnchor === 'top' ? -heightM / 2 : heightM / 2;
  placeholder.position.set(worldX, mountingY + halfOffset, worldZ);
  placeholder.rotation.y = rotY;
  tagObject(placeholder, p);
  return placeholder;
}

/** Bounding-box placeholder mesh (category-coloured fallback material). */
function buildPlaceholder(
  widthMm: number, depthMm: number, heightMm: number, scale: number, matId: string,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(
    widthMm * MM_TO_M * scale,
    heightMm * MM_TO_M * scale,
    depthMm * MM_TO_M * scale,
  );
  const mesh = new THREE.Mesh(geo, getMaterial3D(matId));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Tag the object + all descendant meshes so raycast/selection resolves the entity.
 * ADR-669 — an `Object3D` (library meshes arrive as arbitrary sub-trees), so it stamps via
 * the `stampBimIdentity` SSoT rather than `tagMesh`. Descendants carry the entity keys only:
 * `matId`/`levelId` stay on the root, and the SSoT skips `undefined` so the root's own
 * values survive its pass through `traverse` (which visits `obj` itself first).
 */
function tagObject(obj: THREE.Object3D, p: MeshPlacement): void {
  stampBimIdentity(obj, { bimId: p.bimId, bimType: p.bimType, matId: p.matId, levelId: p.levelId });
  obj.traverse((child) => {
    stampBimIdentity(child, { bimId: p.bimId, bimType: p.bimType });
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}
