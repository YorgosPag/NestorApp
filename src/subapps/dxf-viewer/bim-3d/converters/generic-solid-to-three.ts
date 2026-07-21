/**
 * generic-solid-to-three — παραμετρικό στερεό → THREE.Object3D (ADR-684 Φ2).
 *
 * Procedural converter: χτίζει τη γεωμετρία απευθείας από τις παραμέτρους (μέσω
 * `buildGenericSolidShapeGeometry`), σε αντίθεση με το `imported-mesh`/`furniture` που φορτώνουν
 * εξωτερικό `.glb`. Καθαρός· ο καλών (`BimSceneLayer.syncFloorEntities`) κατέχει τον κύκλο ζωής.
 *
 * Units-safe (pattern από `mesh-to-object3d`):
 *   - PLAN placement (`position`, scene units) → μέτρα via `sceneUnitsToMeters`
 *   - διαστάσεις σχήματος (mm) → μέτρα μέσα στον shape builder
 *
 * Coordinate convention: DXF plan X=East, Y=North → Three.js (Y-up, m) x=East, z=-North.
 *
 * @see ./generic-solid-shape-geometry — ο shape → geometry builder
 * @see ./mesh-to-object3d — η SSoT σύμβαση placement που καθρεφτίζεται εδώ
 */

import * as THREE from 'three';
import type { GenericSolidEntity } from '../../bim/entities/generic-solid/generic-solid-types';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { tagMesh } from './bim-three-shape-helpers';
import { buildGenericSolidShapeGeometry } from './generic-solid-shape-geometry';

const MM_TO_M = 0.001;
const DEG_TO_RAD = Math.PI / 180;

/** Προεπιλεγμένο υλικό όταν δεν έχει ανατεθεί συγκεκριμένο (`getMaterial3D` → default flat). */
const DEFAULT_GENERIC_SOLID_MATERIAL_ID = 'elem-generic-solid';

/**
 * Χτίζει την 3Δ αναπαράσταση ενός παραμετρικού στερεού. Επιστρέφει `null` μόνο για απούσες
 * παραμέτρους (η επικύρωση φρουρεί ανάντη τις εκφυλισμένες διαστάσεις).
 */
export function genericSolidToObject3D(
  solid: GenericSolidEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Object3D | null {
  const { params } = solid;
  if (!params) return null;

  const { geometry, baseOffsetM } = buildGenericSolidShapeGeometry(params.shape);
  const material = getMaterial3D(params.material ?? DEFAULT_GENERIC_SOLID_MATERIAL_ID);
  const mesh = new THREE.Mesh(geometry, material);

  const sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm');
  const worldX = params.position.x * sceneToM;
  const worldZ = -(params.position.y * sceneToM);
  const mountingY =
    (floorElevationMm + params.mountingElevationMm) * MM_TO_M + buildingBaseElevationM;

  mesh.position.set(worldX, mountingY + baseOffsetM, worldZ);
  // Plan CCW (+Z) maps to clockwise about world +Y (plan Y → world -Z mirror).
  mesh.rotation.y = -params.rotationDeg * DEG_TO_RAD;

  return tagMesh(mesh, solid.id, 'generic-solid', params.material ?? DEFAULT_GENERIC_SOLID_MATERIAL_ID, levelId);
}
