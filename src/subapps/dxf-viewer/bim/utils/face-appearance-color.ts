/**
 * face-appearance-color — ADR-539. SSoT για το «χρώμα (CSS hex) μιας όψης» από το
 * per-face appearance override. Κοινό για ΟΛΕΣ τις προβολές:
 *   - 3D painted material (`bim-3d/materials/face-appearance-material.ts`)
 *   - 2D plan top-face fill (`bim/utils/bim-face-plan-fill.ts`, Φ3e)
 *
 * `colorHex` (σκέτο χρώμα) έχει προτεραιότητα· αλλιώς `materialId` → catalog hex μέσω
 * του shared `getWallCoveringColor` SSoT. Καμία πηγή → `null` (επιστροφή σε base look).
 *
 * @see bim/wall-coverings/wall-covering-material-catalog.ts — χρώμα catalog SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { FaceAppearance } from '../types/face-appearance-types';
import { getWallCoveringColor } from '../wall-coverings/wall-covering-material-catalog';
import type { WallCoveringMaterialId } from '../types/wall-covering-types';

/**
 * CSS hex (π.χ. `#C0392B`) μιας όψης ή `null` όταν δεν υπάρχει override. `colorHex`
 * wins· `materialId` προέρχεται από `listWallCoveringMaterials()` (panel) → ασφαλές narrowing.
 */
export function faceAppearanceColorHex(face: FaceAppearance): string | null {
  if (face.colorHex) return face.colorHex;
  if (face.materialId) return getWallCoveringColor(face.materialId as WallCoveringMaterialId);
  return null;
}
