/**
 * Foundation 2Δ render palette (ADR-436, Slice 1).
 *
 * Per-kind stroke + translucent fill colours για τον `FoundationRenderer`.
 * Καθαρό config (μηδέν logic) → εκτός size-cap.
 *
 * Convention: η θεμελίωση είναι κάτω από τη στάθμη → γαιώδες γκρι-μπλε
 * (ευθυγραμμίζεται με `BIM_CATEGORY_LINE_COLORS.foundation = '#6b7a8f'`). Τα
 * line-based kinds (strip/tie-beam) λίγο πιο σκούρα/ψυχρά για διάκριση.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §4.2
 */

import type { FoundationKind } from '../types/foundation-types';

/** Stroke colour per kind (περίγραμμα διακεκομμένο — βλ. FoundationRenderer). */
export const FOUNDATION_KIND_STROKE: Readonly<Record<FoundationKind, string>> = {
  'pad':      '#6b7a8f',
  'strip':    '#566377',
  'tie-beam': '#4a5566',
};

/** Translucent fill (rgba) per kind. ~18% opacity (κάτω από στάθμη → πιο αχνό). */
export const FOUNDATION_KIND_FILL: Readonly<Record<FoundationKind, string>> = {
  'pad':      'rgba(107, 122, 143, 0.18)',
  'strip':    'rgba(86, 99, 119, 0.18)',
  'tie-beam': 'rgba(74, 85, 102, 0.18)',
};
