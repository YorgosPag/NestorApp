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
 * Τρόπος έδρασης ΠΕΡΙΜΕΤΡΙΚΩΝ λωρίδων κατά τη γένεση «Εσχάρα από κάναβο»
 * (ADR-441, ερώτημα Giorgio 2026-06-12 — οι εσωτερικές μένουν ΠΑΝΤΑ `center`):
 *   - `center` → ΟΛΕΣ κεντρικές (ο άξονας στο centerline· concentric).
 *   - `inner`  → περιμετρικές προς τα ΜΕΣΑ (εξωτερική παρειά ΠΑΝΩ στον άξονα·
 *               μηδέν overhang έξω· **default**, κλείνει γωνίες — Slice 5a-grid).
 *   - `outer`  → περιμετρικές προς τα ΕΞΩ (εσωτερική παρειά στον άξονα· η λωρίδα
 *               προεξέχει εκτός του ακραίου οδηγού).
 */
export type GridPerimeterMode = 'center' | 'inner' | 'outer';

/** Default περιμετρικό mode — δομικά σωστό inward (μηδέν αλλαγή vs προ-2026-06-12). */
export const DEFAULT_GRID_PERIMETER_MODE: GridPerimeterMode = 'inner';

/**
 * Η αυτόματη έδραση μιας grid-λωρίδας από τη θέση του **παράλληλου** άξονά της.
 * Περιμετρική (πρώτος/τελευταίος παράλληλος άξονας) → inward/outer ανά `mode`·
 * εσωτερική → ΠΑΝΤΑ `center`.
 *
 * @param orientation   'V' (κατακόρυφη, parallel = X-άξονας) ή 'H' (οριζόντια, parallel = Y-άξονας).
 * @param parallelIndex Index του παράλληλου άξονα στη sorted λίστα (0 = ελάχιστο offset).
 * @param parallelCount Πλήθος παράλληλων αξόνων (≥2 — ο builder το εγγυάται).
 * @param mode          Περιμετρικός τρόπος έδρασης (default `inner`).
 */
export function gridStripJustification(
  orientation: GridStripOrientation,
  parallelIndex: number,
  parallelCount: number,
  mode: GridPerimeterMode = DEFAULT_GRID_PERIMETER_MODE,
): StripJustification {
  if (mode === 'center') return DEFAULT_STRIP_JUSTIFICATION; // όλες κεντρικές
  const isFirst = parallelIndex === 0;
  const isLast = parallelIndex === parallelCount - 1;
  if (!isFirst && !isLast) return DEFAULT_STRIP_JUSTIFICATION; // εσωτερική → center
  // inward (φορά +Y για V / +X για H· CCW normal): V αριστερότερη → 'right' (+X)·
  // H κάτω → 'left' (+Y). Το `outer` είναι το αντίστροφο (περιμετρική προεξέχει).
  const inwardFirst: StripJustification = orientation === 'V' ? 'right' : 'left';
  const inwardLast: StripJustification = orientation === 'V' ? 'left' : 'right';
  if (mode === 'inner') return isFirst ? inwardFirst : inwardLast;
  return isFirst ? inwardLast : inwardFirst; // outer = flip
}
