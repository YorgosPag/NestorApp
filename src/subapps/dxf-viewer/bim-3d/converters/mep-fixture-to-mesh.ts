/**
 * mep-fixture-to-mesh — mesh-based light fixture → THREE.Object3D (ADR-411).
 *
 * Thin consumer of the entity-agnostic `meshToObject3D` SSoT: maps a
 * `MepFixtureEntity` that carries an `assetId` onto a `MeshPlacement` (category
 * `'light-fixture'`, vertical anchor `'top'` — a ceiling/pendant fixture hangs
 * from the mounting plane) and delegates. Returns null for a fixture WITHOUT an
 * `assetId` (the caller falls back to the parametric `fixtureToMesh`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import type * as THREE from 'three';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import { resolveLightFixtureAsset } from '../../bim/mep-fixtures/light-fixture-catalog';
import { meshToObject3D } from './mesh-to-object3d';

/** BIM category → Storage library folder for light-fixture meshes. */
const LIGHT_FIXTURE_MESH_CATEGORY = 'light-fixture';

/**
 * Build the 3D mesh representation of a light-fixture entity, or null when the
 * fixture is parametric (no `assetId`). On a cache miss returns a bbox placeholder
 * and kicks off the async load (via the generic converter).
 */
export function mepFixtureToObject3D(
  fixture: MepFixtureEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Object3D | null {
  const { params } = fixture;
  if (!params?.assetId) return null;

  const preset = resolveLightFixtureAsset(params.assetId);
  // Placeholder bbox: footprint width/length from params; drop-height from the
  // catalog (params has no overall height — only body thickness).
  const heightMm = preset?.heightMm ?? params.bodyHeightMm;

  return meshToObject3D({
    category: LIGHT_FIXTURE_MESH_CATEGORY,
    assetId: params.assetId,
    bimId: fixture.id,
    bimType: 'mep-fixture',
    matId: params.material ?? 'elem-mep-fixture',
    position: params.position,
    rotationDeg: params.rotation,
    scale: params.scaleOverride ?? 1,
    widthMm: params.width,
    depthMm: params.length,
    heightMm,
    sceneUnits: params.sceneUnits ?? 'mm',
    floorElevationMm,
    mountingElevationMm: params.mountingElevationMm,
    verticalAnchor: 'top',
    buildingBaseElevationM,
    levelId,
  });
}
