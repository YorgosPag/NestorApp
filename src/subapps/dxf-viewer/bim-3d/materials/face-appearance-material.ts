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
import type { FaceAppearanceMap } from '../../bim/types/face-appearance-types';
import { BASE_FACE_KEY } from '../../bim/types/face-appearance-types';
// ADR-539 — shared color SSoT (Boy-Scout N.0.2: κοινό με το 2D plan fill της Φ3e).
import { faceAppearanceColorHex } from '../../bim/utils/face-appearance-color';

/**
 * Material για ΜΙΑ όψη. Cascade (Revit/Cinema 4D base+override): `appearance[faceKey]` →
 * αλλιώς το base `appearance['*']` («βάψε όλο») → αλλιώς το `baseMaterial` (κοινό instance,
 * μηδέν regression). Pure (καμία mutation του base). Ο caller dispose-άρει τα νέα materials.
 */
export function resolveFaceMaterial(
  faceKey: string,
  appearance: FaceAppearanceMap,
  baseMaterial: THREE.Material,
): THREE.Material {
  const face = appearance[faceKey] ?? appearance[BASE_FACE_KEY];
  if (!face) return baseMaterial;
  const hex = faceAppearanceColorHex(face);
  if (!hex) return baseMaterial;
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.92,
    metalness: 0,
    // ADR-539 Φ2 — double-sided so a painted hole-wall renders + raycasts from inside the void.
    side: THREE.DoubleSide,
  });
}
