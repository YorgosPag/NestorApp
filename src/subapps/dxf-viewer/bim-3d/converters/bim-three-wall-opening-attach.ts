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
 * Catalog material ids των σωμάτων του κουφώματος — SSoT (δηλώνονται ΜΙΑ φορά εδώ). Το ΙΔΙΟ id
 * που χτίζει το υλικό (`getMaterial3D`) σφραγίζεται και ως `userData.matId` σε κάθε sub-mesh, ώστε
 * η 3Δ εξαγωγή (ADR-668 §10) να το ονομάζει **σημασιολογικά** (`mat-wood`/`mat-glass`) — όπως το
 * Revit/ArchiCAD δίνουν στην κάσα/φύλλο/υαλοστάσιο μιας πόρτας δικές τους named surfaces — αντί για
 * fallback στο χρώμα. Χωρίς αυτό, το `resolveBimMeshIdentity` (ADR-669 §5.6) δεν βρίσκει `matId` στο
 * άνοιγμα και έπεφτε σε `mat_${color}`.
 */
const OPENING_FRAME_MATERIAL_ID = 'mat-wood';   // κάσα + φύλλο (ξύλο)
const OPENING_GLASS_MATERIAL_ID = 'mat-glass';  // υαλοστάσιο

/**
 * Σφραγίζει σε κάθε sub-mesh του κουφώματος το catalog id του υλικού του (export naming SSoT).
 * Το `leaf` μοιράζεται το ΙΔΙΟ singleton με το `frame` (και τα δύο ξύλο), οπότε ο χάρτης
 * material→id έχει δύο εγγραφές· ό,τι mesh δεν ταιριάζει (θεωρητικά κανένα) μένει ασφράγιστο.
 */
function stampOpeningMaterialIds(
  mesh: THREE.Object3D,
  matIdByMaterial: ReadonlyMap<THREE.Material, string>,
): void {
  mesh.traverse((node) => {
    const m = node as THREE.Mesh;
    if (m.isMesh !== true || Array.isArray(m.material)) return;
    const id = matIdByMaterial.get(m.material);
    if (id !== undefined) m.userData['matId'] = id;
  });
}

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
  const frameMat = getMaterial3D(OPENING_FRAME_MATERIAL_ID);
  const glassMat = getMaterial3D(OPENING_GLASS_MATERIAL_ID);
  const materials: OpeningMeshMaterials = { frame: frameMat, leaf: frameMat, glass: glassMat };
  // material singleton → catalog id, για τη σφράγιση `matId` ανά sub-mesh (ADR-668 §10).
  const matIdByMaterial = new Map<THREE.Material, string>([
    [frameMat, OPENING_FRAME_MATERIAL_ID],
    [glassMat, OPENING_GLASS_MATERIAL_ID],
  ]);
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
    stampOpeningMaterialIds(mesh, matIdByMaterial);
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
