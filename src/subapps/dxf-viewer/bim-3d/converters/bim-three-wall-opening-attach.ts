/**
 * Wall opening 3D body attach — ADR-421 §A6.
 *
 * File-private helper εξηγμένο από το `BimToThreeConverter` (file-size SSoT, N.7.1,
 * 2026-07-05). Χτίζει + προσαρτά το parametric 3D mesh κάθε φιλοξενούμενου
 * ανοίγματος (κάσα/φύλλο/υαλοστάσιο = per-part resolved υλικά, `resolveOpeningMaterial`)
 * μέσα στο wall group, με ADR-404 battered-wall shear ώστε τα σώματα κουφωμάτων να
 * ακολουθούν την κλίση.
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { getMaterial3D } from '../materials/MaterialCatalog3D';
import { buildOpeningMesh, type OpeningMeshMaterials } from './opening-mesh';
import { isWallTilted, wallTiltShearAt } from '../../bim/geometry/wall-tilt';
// ADR-404 — object-level tilt SSoT (matrix sibling of applyWallTilt· reuses the wallTiltShearAt amount).
import { horizontalTiltShearMatrix } from './mesh-slope-shear';
// Per-part material resolution SSoT (ADR-669 follow-up) — κάσα/φύλλο/υαλοστάσιο ανά άνοιγμα,
// αντί για ΕΝΑ hardcoded ζεύγος υλικών για όλα τα ανοίγματα του τοίχου.
import { resolveOpeningMaterial } from '../../bim/family-types/resolve-opening-material';

const MM_TO_M = 0.001;

/**
 * Χτίζει τα per-part υλικά (THREE) ενός ανοίγματος + τον χάρτη material→catalog-id για τη
 * σφράγιση `userData.matId` (ADR-668 §10). Το `getMaterial3D` κάνει cache ανά id (singletons),
 * οπότε δύο ανοίγματα με ίδιο resolved id μοιράζονται instance — και frame/leaf μπορούν πλέον
 * να διαφέρουν (Revit per-part), σε αντίθεση με το παλιό ενιαίο `frameMat` για κάσα+φύλλο.
 */
function buildOpeningMaterials(opening: OpeningEntity): {
  materials: OpeningMeshMaterials;
  matIdByMaterial: Map<THREE.Material, string>;
} {
  const mats = resolveOpeningMaterial(opening.params);
  const frame = getMaterial3D(mats.frame);
  const leaf = getMaterial3D(mats.leaf);
  const glass = getMaterial3D(mats.glass);
  const hardware = getMaterial3D(mats.hardware);
  const materials: OpeningMeshMaterials = { frame, leaf, glass, hardware };
  const matIdByMaterial = new Map<THREE.Material, string>([
    [frame, mats.frame],
    [leaf, mats.leaf],
    [glass, mats.glass],
    [hardware, mats.hardware],
  ]);
  return { materials, matIdByMaterial };
}

/**
 * Σφραγίζει σε κάθε sub-mesh του κουφώματος το catalog id του υλικού του (export naming SSoT).
 * Ο χάρτης material→id έχει έως τέσσερις εγγραφές (frame/leaf/glass/hardware) — δύο μπορούν να συμπέσουν
 * σε ίδιο singleton (π.χ. frame===leaf όταν και τα δύο resolve στο ίδιο id, τότε ο χάρτης έχει δύο
 * κλειδιά με ίδιο instance)· ό,τι mesh δεν ταιριάζει (θεωρητικά κανένα) μένει ασφράγιστο.
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
 * `group`. Materials resolved ΑΝΑ ΑΝΟΙΓΜΑ (`resolveOpeningMaterial(opening.params)`,
 * ίδιο idiom με `resolveOpeningFrameProfile`) — κάσα/φύλλο/υαλοστάσιο μπορούν να
 * διαφέρουν ανά instance/type· τα glazed kinds επιλέγουν το resolved γυαλί στο
 * `buildOpeningMesh`. No-op όταν δεν υπάρχουν openings (π.χ. το group προέκυψε
 * λόγω wallTop/wallBase profile).
 *
 * ADR-673 — `finishThicknessMm` (FFL → top-of-structural-slab) is threaded into
 * `buildOpeningMesh` for the door κατώφλι embed («on-slab» βύθιση στο γκρο μπετό).
 */
export function attachOpeningMeshes(
  group: THREE.Object3D,
  wall: WallEntity,
  openings: readonly OpeningEntity[],
  floorElevationMm: number,
  buildingBaseElevationM: number,
  finishThicknessMm: number,
  levelId?: string,
): void {
  if (openings.length === 0) return;
  // ADR-404 — battered wall: τα σώματα κουφωμάτων ακολουθούν την ΙΔΙΑ κλίση με τον τοίχο
  // (αλλιώς 3Δ === 2Δ σπάει — η πόρτα έμενε κατακόρυφη σε κεκλιμένο τοίχο). World-space
  // οριζόντιος shear γραμμικός στο ύψος (ίδιο SSoT `wallTiltShearAt`), αγκυρωμένος στο FFL.
  const floorY = floorElevationMm * MM_TO_M + buildingBaseElevationM;
  const tiltShear = isWallTilted(wall.params)
    ? horizontalTiltShearMatrix((h) => wallTiltShearAt(wall.params, h), floorY)
    : null;
  for (const opening of openings) {
    const { materials, matIdByMaterial } = buildOpeningMaterials(opening);
    const mesh = buildOpeningMesh(opening, wall, materials, floorElevationMm, buildingBaseElevationM, finishThicknessMm);
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
