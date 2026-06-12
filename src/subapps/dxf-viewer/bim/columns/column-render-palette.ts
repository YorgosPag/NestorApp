/**
 * Column 2Δ render palette (ADR-363 Phase 4 / Phase 8).
 *
 * Per-kind stroke + translucent fill colours για τον `ColumnRenderer`. Εξήχθη από
 * `ColumnRenderer.ts` (ADR-404 Phase 3 — file-size split, N.7.1) ώστε ο renderer να
 * μένει < 500 γρ. Καθαρό config (μηδέν logic) → εκτός size-cap.
 *
 * Industry convention — RC συμπαγή φόντα, steel cooler.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type { ColumnKind } from '../types/column-types';

// ADR-445 — Η κολώνα = steel-blue ταυτότητα κατηγορίας. Οι υπο-τύποι είναι ΑΠΟΧΡΩΣΕΙΣ
// του μπλε (όχι ξεχωριστές αποχρώσεις) ώστε «μια κολώνα να διαβάζεται πάντα μπλε»· η
// διάκριση των kinds γίνεται από το ΣΧΗΜΑ (L/T/circular), όχι από το hue. Τα τοιχία Ω.Σ.
// (shear-wall/U/composite) = βαθύτερο μπλε-RC.
/** Stroke colour per kind (blue family). */
export const KIND_STROKE: Readonly<Record<ColumnKind, string>> = {
  'rectangular': '#2f6690',
  'circular':    '#2a5b85',
  'L-shape':     '#356a92',
  'T-shape':     '#2f6690',
  'polygon':     '#3a7099',
  'shear-wall':  '#24506b',
  'I-shape':     '#356a92',
  'U-shape':     '#24506b',
  'composite':   '#24506b',
};

/** Translucent fill (rgba) per kind, blue family. ~22% opacity. */
export const KIND_FILL: Readonly<Record<ColumnKind, string>> = {
  'rectangular': 'rgba(47, 102, 144, 0.22)',
  'circular':    'rgba(42, 91, 133, 0.22)',
  'L-shape':     'rgba(53, 106, 146, 0.22)',
  'T-shape':     'rgba(47, 102, 144, 0.22)',
  'polygon':     'rgba(58, 112, 153, 0.22)',
  'shear-wall':  'rgba(36, 80, 107, 0.25)',
  'I-shape':     'rgba(53, 106, 146, 0.20)',
  'U-shape':     'rgba(36, 80, 107, 0.25)',
  'composite':   'rgba(36, 80, 107, 0.25)',
};
