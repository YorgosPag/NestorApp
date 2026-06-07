/**
 * Slab 2Δ render palette (ADR-363 Phase 3 / ADR-375 C.9).
 *
 * Εξήχθη από τον `SlabRenderer` (inline consts) ώστε ο renderer να μην κρατά
 * hardcoded χρώματα (FULL SSOT, μηδέν hardcoded χρώμα σε renderer).
 *
 * Διαχωρισμός ευθυνών:
 *   - **Line color** (outline) → Object Styles SSoT (`DEFAULT_OBJECT_STYLES.slab`,
 *     taupe), resolver-driven. `KIND_STROKE` μένει μόνο ως fallback όταν ο χρήστης
 *     μηδενίσει το V/G color της πλάκας.
 *   - **Fill tint** (translucent γέμισμα, 2D-only) → `KIND_FILL` (ανά-kind ταυτότητα).
 *
 * Industry convention — warm για συμπαγή στοιχεία, cool για ψυχρές επιφάνειες,
 * RC = γκρι.
 */
import type { SlabKind } from '../types/slab-types';

/** Stroke colour per kind (fallback — το κανονικό outline χρώμα έρχεται από το resolver). */
export const KIND_STROKE: Readonly<Record<SlabKind, string>> = {
  'floor':      '#6e6358',
  'ceiling':    '#5f7286',
  'roof':       '#a04a2b',
  'ground':     '#3d5a3a',
  'foundation': '#3a3a40',
};

/** Translucent fill (rgba) per kind. ~20% opacity. */
export const KIND_FILL: Readonly<Record<SlabKind, string>> = {
  'floor':      'rgba(178, 162, 144, 0.20)',
  'ceiling':    'rgba(140, 158, 178, 0.20)',
  'roof':       'rgba(192, 92, 56, 0.20)',
  'ground':     'rgba(94, 130, 88, 0.20)',
  'foundation': 'rgba(88, 88, 96, 0.22)',
};
