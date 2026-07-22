/**
 * imported-mesh-to-three — εισαγόμενο πλέγμα → THREE.Object3D (ADR-683 Φ3).
 *
 * Λεπτός καταναλωτής του entity-agnostic `meshToObject3D` SSoT (ADR-411), ακριβώς όπως ο αδελφός
 * `furniture-to-three`. Όλη η φόρτωση / cache / placeholder / ασφάλεια μονάδων ζει στον γενικό
 * converter — εδώ γίνεται **μόνο** η αντιστοίχιση οντότητας → `MeshPlacement`.
 *
 * Δύο διαφορές από το έπιπλο, και μόνο αυτές:
 *  1. **Κατηγορία `'imported'`** — δείχνει σε project-scoped Storage path αντί για την curated
 *     βιβλιοθήκη (διαφορετικά storage rules: εδώ γράφει ο χρήστης, εκεί μόνο ο super-admin).
 *  2. **`assetId = <uploadId>#<nodeName>`** — ένα ανεβασμένο `.glb` περιέχει πολλά αντικείμενα
 *     (linked-model), οπότε το κλειδί δείχνει σε **κόμβο**, όχι σε ολόκληρο αρχείο.
 *
 * Οι διαστάσεις είναι οι **μετρημένες** — δίνονται στο placeholder ώστε το κουτί να έχει το σωστό
 * μέγεθος πριν κατέβει το πλέγμα.
 *
 * @see ./furniture-to-three — ο αδελφός με catalog-driven asset
 * @see ./mesh-to-object3d — ο γενικός SSoT (ADR-411)
 */

import type * as THREE from 'three';
import type { ImportedMeshEntity } from '../../bim/entities/imported-mesh/imported-mesh-types';
import {
  IMPORTED_MESH_CATEGORY,
  importedMeshAssetId,
} from '../../bim/entities/imported-mesh/imported-mesh-types';
import { meshToObject3D } from './mesh-to-object3d';
import { applyImportedMeshMaterials } from './imported-mesh-material-enhance';

/**
 * Χτίζει την 3Δ αναπαράσταση ενός εισαγόμενου πλέγματος. Επιστρέφει τοποθετημένο κλώνο του glTF σε
 * cache hit, ή placeholder κουτί σε miss (ξεκινώντας την ασύγχρονη φόρτωση). `null` μόνο για
 * εκφυλισμένη οντότητα.
 */
export function importedMeshToObject3D(
  mesh: ImportedMeshEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
): THREE.Object3D | null {
  const { params } = mesh;
  if (!params) return null;

  const object = meshToObject3D({
    category: IMPORTED_MESH_CATEGORY,
    assetId: importedMeshAssetId(params.uploadId, params.nodeName),
    bimId: mesh.id,
    bimType: 'imported-mesh',
    matId: 'elem-imported-mesh',
    position: params.position,
    rotationDeg: params.rotationDeg,
    // Καμία κλίμακα: το πλέγμα έρχεται στο μέγεθος που το σχεδίασε ο συνεργάτης, και δεν
    // υπάρχει authored διάσταση να «διορθώσει» τυχόν απόκλιση (§3).
    scale: 1,
    widthMm: params.measuredWidthMm,
    depthMm: params.measuredDepthMm,
    heightMm: params.measuredHeightMm,
    sceneUnits: params.sceneUnits ?? 'mm',
    floorElevationMm,
    mountingElevationMm: params.mountingElevationMm,
    verticalAnchor: 'base',
    buildingBaseElevationM,
    levelId,
  });

  // ADR-683 Φ4 — safety-net υλικών: όταν το partner `.glb` ήρθε με χαμένα υλικά (Blender default
  // γκρι), βάψε ανά όνομα σε PBR preset. No-op σε placeholder κουτί (cache miss) και σε authored
  // υλικά (belt-and-suspenders gate) — ένα σωστό export περνά ανέγγιχτο.
  // ADR-686 — user override (`mesh.faceAppearance`: `slot:${name}` per-slot ή `'*'` όλο) νικά πάνω
  // από embedded/preset, ώστε ο χρήστης να αλλάζει χρώμα/υλικό/υφή στο εισαγόμενο έπιπλο.
  applyImportedMeshMaterials(object, mesh.faceAppearance);
  return object;
}
