/**
 * mep-underfloor-to-three — ADR-408 Εύρος Β #3. Pure converter:
 * `MepUnderfloorEntity` → `THREE.Mesh`.
 *
 * Thin planar solid band representing the radiant-floor loop embedded in the screed
 * (IfcSpaceHeater radiant). One per heating area — extrudes the footprint polygon by a
 * thin thickness (the pipe diameter) at the screed elevation, mirroring
 * `floor-finish-to-three.ts` (area thin solid).
 *
 * **UNITS-SAFE** (same pattern as `floor-finish-to-three.ts`):
 *   - canvas-unit XY → Three.js world metres via `sceneUnitsToMeters(units)`
 *   - mm thickness / screedOffset → metres via `MM_TO_M`
 *
 * Axis convention identical to slab/floor-finish (`extrudeAndRotate` handles XY→XZ).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see bim-3d/converters/floor-finish-to-three.ts — the area thin-solid template
 */

import * as THREE from 'three';
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import { DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM } from '../../bim/types/mep-underfloor-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import type { SceneUnits } from '../../utils/scene-units';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildShape, extrudeAndRotate, tagMesh } from './bim-three-shape-helpers';

const MM_TO_M = 0.001;

/** Material key for the embedded radiant-floor band (warm translucent screed layer). */
const UNDERFLOOR_MATERIAL_KEY = 'elem-mep-underfloor';

/**
 * Convert `MepUnderfloorEntity` → `THREE.Mesh`.
 *
 * @param entity            - The underfloor heating BIM entity.
 * @param floorElevationMm  - FFL elevation of the containing floor, in mm. The band
 *                            bottom sits at `floorElevationMm + params.screedOffsetMm`.
 * @param levelId           - Optional level ID for V/G visibility tagging.
 * @param buildingBaseM     - Building base elevation in METRES (ADR-369 §9.2 Q2.1).
 */
export function underfloorToMesh(
  entity: MepUnderfloorEntity,
  floorElevationMm: number,
  levelId?: string,
  buildingBaseM = 0,
): THREE.Mesh | null {
  const { footprint, screedOffsetMm, connectorDiameterMm, sceneUnits } = entity.params;
  if (!footprint || footprint.vertices.length < 3) return null;

  const units: SceneUnits = sceneUnits ?? 'mm';
  const xyScale = sceneUnitsToMeters(units);
  const scaledVerts = footprint.vertices.map((v) => ({ x: v.x * xyScale, y: v.y * xyScale, z: v.z }));

  const shape = buildShape(scaledVerts);
  if (!shape) return null;

  // Thin band the height of the pipe (the loop is embedded in the screed).
  const thickness = (connectorDiameterMm ?? DEFAULT_UNDERFLOOR_CONNECTOR_DIAMETER_MM) * MM_TO_M;
  const geo = extrudeAndRotate(shape, thickness);

  const mat = getMaterial3D(UNDERFLOOR_MATERIAL_KEY);
  const mesh = new THREE.Mesh(geo, mat);

  const bottomMm = floorElevationMm + (screedOffsetMm ?? 0);
  mesh.position.y = bottomMm * MM_TO_M + buildingBaseM;

  return tagMesh(mesh, entity.id, 'mep-underfloor', UNDERFLOOR_MATERIAL_KEY, levelId);
}
