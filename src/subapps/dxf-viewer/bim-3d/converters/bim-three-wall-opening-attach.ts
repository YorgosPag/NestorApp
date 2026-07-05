/**
 * Wall opening 3D body attach — ADR-421 §A6.
 *
 * File-private helper εξηγμένο από το `BimToThreeConverter` (file-size SSoT, N.7.1,
 * 2026-07-05). Χτίζει + προσαρτά το parametric 3D mesh κάθε φιλοξενούμενου
 * ανοίγματος (κάσα/φύλλο = ξύλο, υαλοστάσιο = γυαλί) μέσα στο wall group, με
 * ADR-404 battered-wall shear ώστε τα σώματα κουφωμάτων να ακολουθούν την κλίση.
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildOpeningMesh, type OpeningMeshMaterials } from './opening-mesh';
import { isWallTilted, wallTiltShearAt } from '../../bim/geometry/wall-tilt';
// ADR-404 — object-level tilt SSoT (matrix sibling of applyWallTilt· reuses the wallTiltShearAt amount).
import { horizontalTiltShearMatrix } from './mesh-slope-shear';

const MM_TO_M = 0.001;

/**
 * Build + attach the parametric 3D mesh of each hosted opening into the wall
 * `group`. Materials resolved once (κάσα/φύλλο = ξύλο, υαλοστάσιο = γυαλί· τα
 * glazed kinds επιλέγουν γυαλί στο `buildOpeningMesh`). No-op όταν δεν υπάρχουν
 * openings (π.χ. το group προέκυψε λόγω wallTop/wallBase profile).
 */
export function attachOpeningMeshes(
  group: THREE.Object3D,
  wall: WallEntity,
  openings: readonly OpeningEntity[],
  floorElevationMm: number,
  buildingBaseElevationM: number,
  levelId?: string,
): void {
  if (openings.length === 0) return;
  const materials: OpeningMeshMaterials = {
    frame: getMaterial3D('mat-wood'),
    leaf: getMaterial3D('mat-wood'),
    glass: getMaterial3D('mat-glass'),
  };
  // ADR-404 — battered wall: τα σώματα κουφωμάτων ακολουθούν την ΙΔΙΑ κλίση με τον τοίχο
  // (αλλιώς 3Δ === 2Δ σπάει — η πόρτα έμενε κατακόρυφη σε κεκλιμένο τοίχο). World-space
  // οριζόντιος shear γραμμικός στο ύψος (ίδιο SSoT `wallTiltShearAt`), αγκυρωμένος στο FFL.
  const floorY = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  const tiltShear = isWallTilted(wall.params)
    ? horizontalTiltShearMatrix((h) => wallTiltShearAt(wall.params, h), floorY)
    : null;
  for (const opening of openings) {
    const mesh = buildOpeningMesh(opening, wall, materials, floorElevationMm, buildingBaseElevationM);
    if (!mesh) continue;
    if (levelId !== undefined) mesh.userData['levelId'] = levelId;
    if (tiltShear) {
      // Wrapper με matrix shear (μη-TRS) → κλίνει όλα τα descendants στο world χωρίς mutation γεωμετρίας.
      const shearNode = new THREE.Object3D();
      shearNode.matrixAutoUpdate = false;
      shearNode.matrix.copy(tiltShear);
      shearNode.add(mesh);
      group.add(shearNode);
    } else {
      group.add(mesh);
    }
  }
}
