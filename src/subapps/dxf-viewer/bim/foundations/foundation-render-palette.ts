/**
 * Foundation 2Δ render palette (ADR-436, Slice 1).
 *
 * Per-kind stroke + translucent fill colours για τον `FoundationRenderer`.
 * Καθαρό config (μηδέν logic) → εκτός size-cap.
 *
 * Convention (ADR-445): η θεμελίωση είναι κάτω από τη στάθμη → sienna/γήινο χρώμα
 * (ευθυγραμμίζεται με `BIM_CATEGORY_LINE_COLORS.foundation = '#8a5a3c'`). Τα 3 kinds
 * = ΔΙΑΚΡΙΤΕΣ αποχρώσεις sienna (light→dark: pad/strip/tie-beam) ώστε να ξεχωρίζουν
 * (πριν ήταν 3 σχεδόν ίδια γκρι-μπλε).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4.2
 */

import type { FoundationKind } from '../types/foundation-types';

/** Stroke colour per kind (sienna family, light→dark· περίγραμμα διακεκομμένο). */
export const FOUNDATION_KIND_STROKE: Readonly<Record<FoundationKind, string>> = {
  'pad':      '#8a5a3c',
  'strip':    '#754a30',
  'tie-beam': '#5f3c26',
};

/** Translucent fill (rgba) per kind, sienna family. ~18% opacity (κάτω από στάθμη → αχνό). */
export const FOUNDATION_KIND_FILL: Readonly<Record<FoundationKind, string>> = {
  'pad':      'rgba(138, 90, 60, 0.18)',
  'strip':    'rgba(117, 74, 48, 0.18)',
  'tie-beam': 'rgba(95, 60, 38, 0.18)',
};
