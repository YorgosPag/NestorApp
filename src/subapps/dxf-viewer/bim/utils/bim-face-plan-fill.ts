/**
 * bim-face-plan-fill — ADR-539 Φ3e. SSoT για το «top face → 2D plan body fill».
 *
 * Στην κάτοψη βλέπουμε το solid από πάνω → η βαμμένη ΑΝΩ όψη (`faceAppearance['top']`,
 * Cinema 4D «Polygon Mode») γίνεται το χρώμα γεμίσματος του σώματος (Revit «Paint on
 * face» seen in plan). FULL SSoT reuse:
 *   - `faceAppearanceColorHex` (ίδια επίλυση χρώματος με το 3D painted material)
 *   - `hexToRgba` (translucent poché· ίδιο με floor-finish/soffit swatches)
 *   - `adaptFillTintForCanvas` (ίδιο background-adaptive boost με το `resolveBimBodyFill`)
 *
 * Solids με ΕΝΑ άνω cap (slab/foundation/column) έχουν νόημα· το roof (per-«νερό»
 * `sub:i:top`, χωρίς ενιαίο `top`) ΔΕΝ καλύπτεται εδώ (κάτοψη με πολλά νερά = future).
 *
 * @see bim/utils/face-appearance-color.ts — color SSoT (κοινό 2D+3D)
 * @see bim/utils/bim-body-fill.ts — το legacy body fill που κάνει override
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { FaceAppearanceMap } from '../types/face-appearance-types';
import { faceAppearanceColorHex } from './face-appearance-color';
import { hexToRgba } from './bim-vg-fill-tint';
import { adaptFillTintForCanvas } from '../../config/adaptive-entity-color';

/** ADR-539 Φ3e — διαφάνεια του top-face paint ως 2D plan body fill (poché, βλέπει hatch από κάτω). */
const TOP_FACE_PLAN_ALPHA = 0.55;

/**
 * Το 2D plan body-fill για τη βαμμένη ΑΝΩ όψη ενός solid, ή `null` όταν δεν έχει `top`
 * paint (→ ο caller κρατά το legacy body fill). Pure· ίδιο adaptive layer με τα υπόλοιπα
 * BIM body fills ⇒ ΙΔΙΑ διαφάνεια σε κάθε φόντο.
 */
export function topFacePlanFill(
  entity: { readonly faceAppearance?: FaceAppearanceMap },
  bgHex?: string,
): string | null {
  const top = entity.faceAppearance?.['top'];
  if (!top) return null;
  const hex = faceAppearanceColorHex(top);
  if (!hex) return null;
  return adaptFillTintForCanvas(hexToRgba(hex, TOP_FACE_PLAN_ALPHA) ?? hex, bgHex);
}
