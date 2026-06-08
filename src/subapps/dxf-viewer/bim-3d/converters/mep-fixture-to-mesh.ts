/**
 * mep-fixture-to-mesh — mesh-based MEP fixture → THREE.Object3D (ADR-411).
 *
 * Thin consumer of the entity-agnostic `meshToObject3D` SSoT: maps a
 * `MepFixtureEntity` that carries an `assetId` onto a `MeshPlacement` and
 * delegates. Returns null for a fixture WITHOUT an `assetId` (the caller falls
 * back to the parametric `fixtureToMesh`).
 *
 * The Storage library folder + vertical anchor are resolved per fixture kind:
 *   - sanitary terminals (shower/bathtub/…) → category `'sanitary'`, anchor
 *     `'base'` (floor-standing; the mesh sits ON the mounting plane).
 *   - light fixtures → category `'light-fixture'`, anchor `'top'` (a ceiling/
 *     pendant fixture hangs FROM the mounting plane).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import type * as THREE from 'three';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import { resolveFixtureMeshCategory } from '../../bim/types/mep-fixture-types';
import { resolveLightFixtureAsset } from '../../bim/mep-fixtures/light-fixture-catalog';
import { resolveSanitaryFixtureAsset } from '../../bim/mep-fixtures/sanitary-fixture-mesh-catalog';
import { isSanitaryKind } from '../../bim/sanitary/sanitary-symbol-spec';
import { meshToObject3D, type MeshPlacement } from './mesh-to-object3d';

/** Per-kind mesh routing: Storage folder, placeholder height, vertical anchor. */
interface FixtureMeshRouting {
  readonly category: string;
  readonly heightMm: number;
  readonly verticalAnchor: MeshPlacement['verticalAnchor'];
}

/**
 * Resolve the Storage category + placeholder height + vertical anchor for a
 * fixture's mesh. `params` has no overall height (only body thickness), so the
 * placeholder bbox height comes from the catalog preset, falling back to the body.
 */
function resolveFixtureMeshRouting(
  fixture: MepFixtureEntity,
  assetId: string,
): FixtureMeshRouting {
  const category = resolveFixtureMeshCategory(fixture.params.kind);
  if (isSanitaryKind(fixture.params.kind)) {
    const preset = resolveSanitaryFixtureAsset(assetId);
    return {
      category,
      heightMm: preset?.heightMm ?? fixture.params.bodyHeightMm,
      verticalAnchor: 'base',
    };
  }
  const preset = resolveLightFixtureAsset(assetId);
  return {
    category,
    heightMm: preset?.heightMm ?? fixture.params.bodyHeightMm,
    verticalAnchor: 'top',
  };
}

/**
 * Build the 3D mesh representation of a fixture entity, or null when the fixture
 * is parametric (no `assetId`). On a cache miss returns a bbox placeholder and
 * kicks off the async load (via the generic converter).
 */
export function mepFixtureToObject3D(
  fixture: MepFixtureEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Object3D | null {
  const { params } = fixture;
  if (!params?.assetId) return null;

  const routing = resolveFixtureMeshRouting(fixture, params.assetId);

  return meshToObject3D({
    category: routing.category,
    assetId: params.assetId,
    bimId: fixture.id,
    bimType: 'mep-fixture',
    matId: params.material ?? 'elem-mep-fixture',
    position: params.position,
    rotationDeg: params.rotation,
    scale: params.scaleOverride ?? 1,
    widthMm: params.width,
    depthMm: params.length,
    heightMm: routing.heightMm,
    sceneUnits: params.sceneUnits ?? 'mm',
    floorElevationMm,
    mountingElevationMm: params.mountingElevationMm,
    verticalAnchor: routing.verticalAnchor,
    buildingBaseElevationM,
    levelId,
  });
}
