/**
 * polygon-material-dnd — ADR-539 Φ2. SSoT για το HTML5 drag-drop υλικού/χρώματος πάνω
 * σε όψη δομικού solid (Cinema 4D «Polygon Mode» υπογραφή). ΕΝΑ MIME + serialize/parse,
 * κοινό για τον drag source (`PolygonMaterialPanel` swatch) ΚΑΙ τον drop target
 * (`use-polygon-drag-drop`) → μηδέν διπλό payload format.
 *
 * Το payload είναι ένα `FaceAppearance` ({materialId} ή {colorHex}) — ακριβώς ό,τι δέχεται
 * το `SetFaceAppearanceCommand` + ο `resolveFaceMaterial`.
 *
 * @see bim/types/face-appearance-types.ts — FaceAppearance
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { FaceAppearance } from '../../bim/types/face-appearance-types';

/** Custom MIME — drag ξεκινά εκτός canvas (panel) → καμία σύγκρουση με OrbitControls. */
export const BIM_MATERIAL_MIME = 'application/x-bim-material';

/** Serialize ένα `FaceAppearance` για το `dataTransfer.setData`. */
export function serializeFaceAppearanceDrag(value: FaceAppearance): string {
  return JSON.stringify(value);
}

/**
 * Parse το drag payload από ένα `DataTransfer`. Επιστρέφει `null` όταν λείπει το MIME ή
 * το JSON είναι malformed / χωρίς έγκυρο `materialId`|`colorHex` (Firestore-safe: μόνο τα
 * ορισμένα κλειδιά περνούν, κανένα explicit `undefined`).
 */
export function parseFaceAppearanceDrag(dataTransfer: DataTransfer): FaceAppearance | null {
  const raw = dataTransfer.getData(BIM_MATERIAL_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FaceAppearance>;
    const hasMaterial = typeof parsed.materialId === 'string';
    const hasColor = typeof parsed.colorHex === 'string';
    if (!hasMaterial && !hasColor) return null;
    return {
      ...(hasMaterial ? { materialId: parsed.materialId } : {}),
      ...(hasColor ? { colorHex: parsed.colorHex } : {}),
    };
  } catch {
    return null; // malformed payload — ignore
  }
}
