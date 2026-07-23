/**
 * railing-appearance-color — ADR-407 Φ8. 2D plan color SSoT για το βαμμένο κιγκλίδωμα. Αδελφό του
 * 3D `resolveRailingMaterial`: ίδια cascade (per-component → whole-railing → default), αλλά
 * επιστρέφει CSS hex για τον 2D renderer (τα υφασμένα υλικά προβάλλονται με το αντιπροσωπευτικό
 * τους χρώμα στην κάτοψη — Revit/ArchiCAD plan convention). Χρησιμοποιεί το κοινό
 * {@link faceAppearanceColorHex} (colorHex wins· αλλιώς materialId→catalog color).
 *
 * `null` όταν καμία πηγή appearance δεν δίνει χρώμα → ο renderer πέφτει στο default railing palette.
 *
 * @see bim-3d/materials/railing-material-resolver.ts — το 3D ισοδύναμο (ίδια cascade)
 * @see bim/utils/face-appearance-color.ts — faceAppearanceColorHex SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { RailingComponent, RailingParams } from '../types/railing-types';
import { faceAppearanceColorHex } from '../utils/face-appearance-color';

/**
 * CSS hex για ένα component κιγκλιδώματος (`'post'|'baluster'|'rail'`) βάσει της cascade
 * per-component → whole-railing appearance, ή `null` αν κανένα override δεν ορίζει χρώμα.
 */
export function railingComponentColorHex(
  params: RailingParams,
  component: RailingComponent,
): string | null {
  const componentAppearance = params.componentAppearance?.[component];
  if (componentAppearance) {
    const hex = faceAppearanceColorHex(componentAppearance);
    if (hex) return hex;
  }
  if (params.appearance) {
    const hex = faceAppearanceColorHex(params.appearance);
    if (hex) return hex;
  }
  return null;
}
