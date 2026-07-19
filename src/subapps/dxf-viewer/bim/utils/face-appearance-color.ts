/**
 * face-appearance-color — ADR-539. SSoT για το «χρώμα (CSS hex) μιας όψης» από το
 * per-face appearance override. Κοινό για ΟΛΕΣ τις προβολές:
 *   - 3D painted material (`bim-3d/materials/face-appearance-material.ts`)
 *   - 2D plan top-face fill (`bim/utils/bim-face-plan-fill.ts`, Φ3e)
 *
 * `colorHex` (σκέτο χρώμα) έχει προτεραιότητα· αλλιώς `materialId` → χρώμα καταλόγου μέσω
 * του ενοποιημένου {@link getMaterialColorById} (ADR-679 Φ2a: wall-covering + δάπεδα +
 * library `bmat_*` υλικά — όχι πλέον μόνο wall-covering). Καμία πηγή → `null` (base look).
 *
 * @see ../materials/material-color-registry — ο ενοποιημένος λύτης χρώματος-ανά-id (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { FaceAppearance } from '../types/face-appearance-types';
import { getMaterialColorById } from '../materials/material-color-registry';

/**
 * CSS hex (π.χ. `#C0392B`) μιας όψης ή `null` όταν δεν υπάρχει override. `colorHex`
 * wins· `materialId` λύνεται από ΟΛΟΥΣ τους καταλόγους όψης (ADR-679 registry).
 */
export function faceAppearanceColorHex(face: FaceAppearance): string | null {
  if (face.colorHex) return face.colorHex;
  if (face.materialId) return getMaterialColorById(face.materialId);
  return null;
}
