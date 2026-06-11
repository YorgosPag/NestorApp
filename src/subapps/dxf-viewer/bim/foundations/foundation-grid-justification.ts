/**
 * ADR-441 Slice 5a-grid — Κανόνας αυτόματης έδρασης άξονα (justification) εσχάρας.
 *
 * Pure SSoT για το ΠΟΥ κάθεται κάθε λωρίδα ως προς τον άξονά της κατά τη γένεση
 * «Εσχάρα από κάναβο» (Revit managed grid). Δομικά σωστό default:
 *   - **Περιμετρικές** λωρίδες (στους ακραίους άξονες) → αναπτύσσονται **προς τα μέσα**
 *     (inward) ώστε η εξωτερική παρειά να πέφτει ΠΑΝΩ στον άξονα → μηδέν overhang έξω
 *     από το περίγραμμα/όριο, γωνίες κλείνουν φυσικά (αντικαθιστά το corner-fill).
 *   - **Εσωτερικές** λωρίδες → `center` (concentric, μηδενική εκκεντρότητα — δομικά ιδανικό).
 *
 * Ο μηχανικός υπερισχύει ανά λωρίδα μέσω 5a-control (ribbon)· η χειροκίνητη επιλογή του
 * επιβιώνει της αναγέννησης (το justification δεν συμμετέχει στο `gridStripSignature`).
 *
 * Σήμανση (relative στη φορά σχεδίασης start→end, μέσω SSoT `JUSTIFICATION_NORMAL_SIGN`
 * + CCW normal στο `buildBandFootprint`):
 *   - Κατακόρυφη (V, φορά +Y, normal=−X):  αριστερότερη (parallelIndex 0) → `right` (αναπτύσσεται +X)·
 *                                          δεξιότερη (last) → `left` (−X).
 *   - Οριζόντια  (H, φορά +X, normal=+Y):  κάτω (0) → `left` (+Y)· πάνω (last) → `right` (−Y).
 *
 * @see ../geometry/foundation-geometry.ts — buildBandFootprint (honors justification)
 * @see ../types/foundation-types.ts — StripJustification, JUSTIFICATION_NORMAL_SIGN
 * @see ./foundation-from-grid.ts — consumer (grid builder)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import {
  DEFAULT_STRIP_JUSTIFICATION,
  type StripJustification,
} from '../types/foundation-types';

/** Προσανατολισμός λωρίδας: κατακόρυφη (παράλληλη σε X-άξονα) ή οριζόντια. */
export type GridStripOrientation = 'V' | 'H';

/**
 * Η αυτόματη έδραση μιας grid-λωρίδας από τη θέση του **παράλληλου** άξονά της.
 * Περιμετρική (πρώτος/τελευταίος παράλληλος άξονας) → inward· αλλιώς → `center`.
 *
 * @param orientation   'V' (κατακόρυφη, parallel = X-άξονας) ή 'H' (οριζόντια, parallel = Y-άξονας).
 * @param parallelIndex Index του παράλληλου άξονα στη sorted λίστα (0 = ελάχιστο offset).
 * @param parallelCount Πλήθος παράλληλων αξόνων (≥2 — ο builder το εγγυάται).
 */
export function gridStripJustification(
  orientation: GridStripOrientation,
  parallelIndex: number,
  parallelCount: number,
): StripJustification {
  const isFirst = parallelIndex === 0;
  const isLast = parallelIndex === parallelCount - 1;
  if (!isFirst && !isLast) return DEFAULT_STRIP_JUSTIFICATION; // εσωτερική → center
  if (orientation === 'V') {
    // V: φορά +Y, CCW normal = −X. inward της αριστερότερης = +X = sign −1 = 'right'.
    return isFirst ? 'right' : 'left';
  }
  // H: φορά +X, CCW normal = +Y. inward της κάτω = +Y = sign +1 = 'left'.
  return isFirst ? 'left' : 'right';
}
