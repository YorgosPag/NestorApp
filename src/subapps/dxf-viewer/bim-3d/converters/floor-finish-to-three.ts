/**
 * floor-finish-to-three — ADR-419. Pure converter: `FloorFinishEntity` → `THREE.Mesh`.
 *
 * Thin planar solid (10–50mm) για `floor-finish` entity (IfcCovering FLOORING).
 * Εφαρμόζεται πάνω στην πλάκα, ένα ανά δωμάτιο.
 *
 * **UNITS-SAFE** (pattern από `railing-to-three.ts` + `BimToThreeConverter.slabToMesh`):
 *   - canvas-unit XY → Three.js world metres via `sceneUnitsToMeters(units)`
 *   - mm thickness / finishLevel → metres via `MM_TO_M`
 *
 * Axis convention (ίδιο με BimSceneLayer/slab):
 *   DXF plan: X = East, Y = North
 *   Three.js world (Y-up, metres): x = East, y = Up, z = −North
 *   `extrudeAndRotate` handles the XY → XZ rotation (ROT_X_NEG_90).
 *
 * Material: PbrSlug → DNA material prefix → `getMaterial3D()` SSoT.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 * @see BimToThreeConverter.slabToMesh   — units + extrude pattern
 * @see bim-three-shape-helpers.ts       — buildShape + extrudeAndRotate + tagMesh
 */

import * as THREE from 'three';
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import { DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM } from '../../bim/types/floor-finish-types';
import { getFloorFinishPbrSlug } from '../../bim/floor-finishes/floor-finish-material-catalog';
import type { PbrTextureSlug } from '../../bim/materials/bim-texture-registry';
import { tileSizeMForMaterialId } from '../../bim/materials/bim-texture-registry';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import type { SceneUnits } from '../../utils/scene-units';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh } from './bim-three-shape-helpers';
import { setPlanarTileUvs } from './bim-uv-helpers';

const MM_TO_M = 0.001;

const DEFAULT_FLOOR_TILE_SIZE_M = 0.3;

/** Maps a PBR texture slug to a DNA material prefix string for `getMaterial3D`. */
const PBR_SLUG_TO_MAT_KEY: Partial<Record<PbrTextureSlug, string>> = {
  wood:       'mat-wood',
  tile:       'mat-tile',
  stone:      'mat-stone',
  concrete:   'mat-concrete',
  plaster:    'mat-plaster',
  brick:      'mat-brick',
  metal:      'mat-metal',
  'roof-tiles': 'mat-finish',
};

/**
 * Resolve the Three.js material + matKey for a FloorFinish entity's material ID.
 * Returns both so the converter can also look up the base tile size via matKey.
 */
function resolveFloorFinishMaterial3D(materialId: string): { mat: THREE.MeshStandardMaterial; matKey: string } {
  const slug = getFloorFinishPbrSlug(materialId);
  const matKey = (slug && PBR_SLUG_TO_MAT_KEY[slug]) ?? 'mat-finish';
  return { mat: getMaterial3D(matKey), matKey };
}

/**
 * Convert `FloorFinishEntity` → `THREE.Mesh`.
 *
 * @param entity            - The floor-finish BIM entity.
 * @param floorElevationMm  - FFL (Finished Floor Level) elevation of the containing
 *                            floor, in mm. The mesh bottom face sits at
 *                            `floorElevationMm + entity.params.finishLevel` mm above
 *                            the building base.
 * @param levelId           - Optional level ID for V/G visibility tagging.
 * @param buildingBaseM     - Building base elevation in METRES (ADR-369 §9.2 Q2.1).
 */
export function floorFinishToMesh(
  entity: FloorFinishEntity,
  floorElevationMm: number,
  levelId?: string,
  buildingBaseM = 0,
): THREE.Mesh | null {
  const { footprint, materialId, thicknessMm, finishLevel, sceneUnits,
          tileLengthMm, tileWidthMm, tileRotate90 } = entity.params;
  if (!footprint || footprint.vertices.length < 3) return null;

  const units: SceneUnits = sceneUnits ?? 'm';
  const xyScale = sceneUnitsToMeters(units);
  const scaledVerts = footprint.vertices.map((v) => ({ x: v.x * xyScale, y: v.y * xyScale, z: v.z }));

  const shape = buildShape(scaledVerts);
  if (!shape) return null;

  const thickness = (thicknessMm ?? DEFAULT_FLOOR_FINISH_LAYER_THICKNESS_MM) * MM_TO_M;
  const geo = extrudeAndRotate(shape, thickness);

  const { mat, matKey } = resolveFloorFinishMaterial3D(materialId);

  // ADR-419 §texture-appearance — apply physically-scaled planar UVs when tile
  // dimensions are explicitly set. Otherwise ExtrudeGeometry auto-UVs (already
  // world-scale) are used as-is, which looks fine for default 1× tiling.
  if (tileLengthMm || tileWidthMm || tileRotate90) {
    const baseM = tileSizeMForMaterialId(matKey) ?? DEFAULT_FLOOR_TILE_SIZE_M;
    const lenM = (tileLengthMm ?? baseM * 1000) * MM_TO_M;
    const widM = (tileWidthMm ?? baseM * 1000) * MM_TO_M;
    setPlanarTileUvs(geo, {
      scaleU: 1 / widM,
      scaleV: 1 / lenM,
      rotate90: tileRotate90,
    });
  }
  const mesh = new THREE.Mesh(geo, mat);

  const bottomMm = floorElevationMm + (finishLevel ?? 0);
  mesh.position.y = bottomMm * MM_TO_M + buildingBaseM;

  return tagMesh(mesh, entity.id, 'floor-finish', materialId, levelId);
}
