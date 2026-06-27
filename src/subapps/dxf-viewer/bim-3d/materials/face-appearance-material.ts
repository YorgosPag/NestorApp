/**
 * face-appearance-material — ADR-539. Επιλύει το THREE material μιας όψης από το
 * per-face appearance override. Mirror του `attachSoffitFinish` (ADR-534): χρώμα από
 * το shared wall-covering catalog SSoT (`getWallCoveringColor`) ή σκέτο hex.
 *
 * Όψη ΧΩΡΙΣ override → επιστρέφει το `baseMaterial` (legacy single-material look,
 * byte-for-byte). Έτσι ο πίνακας `material[]` του faced prism έχει το base σε κάθε
 * αβαφή θέση και ένα flat-colour material μόνο στις βαμμένες.
 *
 * @see bim/wall-coverings/wall-covering-material-catalog.ts — χρώμα catalog SSoT
 * @see bim-3d/converters/bim-three-faced-prism.ts — faceKey ↔ materialIndex
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import * as THREE from 'three';
import type { FaceAppearance, FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { getWallCoveringColor } from '../../bim/wall-coverings/wall-covering-material-catalog';
import type { WallCoveringMaterialId } from '../../bim/types/wall-covering-types';

/** Χρώμα (CSS hex) μιας όψης ή `null` όταν δεν υπάρχει override (→ base material). */
function faceColorHex(face: FaceAppearance): string | null {
  if (face.colorHex) return face.colorHex;
  // materialId προέρχεται από `listWallCoveringMaterials()` (panel) → ασφαλές narrowing.
  if (face.materialId) return getWallCoveringColor(face.materialId as WallCoveringMaterialId);
  return null;
}

/**
 * Material για ΜΙΑ όψη. `appearance[faceKey]` με χρώμα/υλικό → flat MeshStandardMaterial·
 * αλλιώς το `baseMaterial` (κοινό instance, μηδέν regression). Pure (καμία mutation
 * του base). Ο caller είναι υπεύθυνος για το dispose των νέων materials στο rebuild.
 */
export function resolveFaceMaterial(
  faceKey: string,
  appearance: FaceAppearanceMap,
  baseMaterial: THREE.Material,
): THREE.Material {
  const face = appearance[faceKey];
  if (!face) return baseMaterial;
  const hex = faceColorHex(face);
  if (!hex) return baseMaterial;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.92,
    metalness: 0,
    // ADR-539 Φ2 — double-sided so a painted hole-wall renders + raycasts from inside the void.
    side: THREE.DoubleSide,
  });
}
