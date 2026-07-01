/**
 * ADR-363 §5.6b — Τοιχίο (shear-wall): SOFT όρια πάχους/μήκους (advisory, ΠΟΤΕ block).
 *
 * Pure SSoT για τον έλεγχο «ασυνήθιστων» διαστάσεων τοιχίου. Οι Ευρωκώδικες (EC2/EC8)
 * ΔΕΝ ορίζουν μέγιστο πάχος ή μήκος — μόνο ΕΛΑΧΙΣΤΑ (`MIN_SHEAR_WALL_THICKNESS_MM`) +
 * απαιτήσεις οπλισμού· οι μεγάλοι (Revit/ETABS/Tekla) δεν βάζουν hard cap. Άρα εδώ
 * **δεν μπλοκάρουμε ποτέ** — απλώς προειδοποιούμε (🟠 πορτοκαλί ghost + confirm) όταν
 * το τοιχίο βγαίνει εκτός τυπικού εύρους:
 *   - πάχος > `MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM` (1.5m) → «μαζικό σκυρόδεμα», όχι λεπτό τοιχίο.
 *   - μήκος > `MAX_TYPICAL_SHEAR_WALL_LENGTH_MM` (30m) → απαιτείται αρμός (ρηγμάτωση EC2 §7.3).
 *
 * thickness = μικρή πλευρά, length = μεγάλη πλευρά (order-agnostic min/max, όπως ο aspect).
 *
 * @see ./column-aspect.ts — αδελφός detector (κολόνα→τοιχίο βάσει aspect)
 * @see ./shear-wall-extent-confirm-store.ts — edit-time warn store
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6b
 */

import {
  MAX_TYPICAL_SHEAR_WALL_LENGTH_MM,
  MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM,
  type ColumnParams,
} from '../types/column-types';

/** Πληροφορία της προειδοποίησης (ποια διάσταση ξεπερνά + οι τιμές, για το μήνυμα). */
export interface ShearWallExtentWarning {
  readonly thickTooLarge: boolean;
  readonly lengthTooLarge: boolean;
  /** Μικρή πλευρά (πάχος, mm). */
  readonly thicknessMm: number;
  /** Μεγάλη πλευρά (μήκος, mm). */
  readonly lengthMm: number;
}

/** thickness = min(width,depth), length = max(width,depth) — order-agnostic. */
function wallThicknessLength(p: Pick<ColumnParams, 'width' | 'depth'>): {
  thicknessMm: number;
  lengthMm: number;
} {
  return { thicknessMm: Math.min(p.width, p.depth), lengthMm: Math.max(p.width, p.depth) };
}

/** Ποια όρια ξεπερνά μια διατομή (πάχος / μήκος). */
export function isShearWallExtentExceeded(p: Pick<ColumnParams, 'width' | 'depth'>): {
  thick: boolean;
  length: boolean;
} {
  const { thicknessMm, lengthMm } = wallThicknessLength(p);
  return {
    thick: thicknessMm > MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM,
    length: lengthMm > MAX_TYPICAL_SHEAR_WALL_LENGTH_MM,
  };
}

/**
 * Edit-time φύλακας: επιστρέφει non-null ΜΟΝΟ όταν ένα **τοιχίο** (`shear-wall`), μετά την
 * αλλαγή διαστάσεων, ξεπερνά για ΠΡΩΤΗ φορά κάποιο advisory όριο (πάχος ή μήκος):
 *   - next: shear-wall, πάχος > 1.5m ή μήκος > 30m
 *   - το prev ΔΕΝ ξεπερνούσε ήδη το ΙΔΙΟ όριο (καμία επανα-ειδοποίηση σε επόμενα edits).
 * Επιστρέφει `null` όταν το next δεν είναι shear-wall, ή δεν υπάρχει ΝΕΑ υπέρβαση.
 */
export function detectShearWallExtentCrossing(
  prev: ColumnParams,
  next: ColumnParams,
): ShearWallExtentWarning | null {
  if (next.kind !== 'shear-wall') return null;
  const nextEx = isShearWallExtentExceeded(next);
  if (!nextEx.thick && !nextEx.length) return null;
  // prev-ήδη-εκτός στην ΙΔΙΑ διάσταση → όχι νέα υπέρβαση (μη νοχλείς ξανά).
  const prevEx = prev.kind === 'shear-wall'
    ? isShearWallExtentExceeded(prev)
    : { thick: false, length: false };
  const newThick = nextEx.thick && !prevEx.thick;
  const newLength = nextEx.length && !prevEx.length;
  if (!newThick && !newLength) return null;
  const { thicknessMm, lengthMm } = wallThicknessLength(next);
  return { thickTooLarge: nextEx.thick, lengthTooLarge: nextEx.length, thicknessMm, lengthMm };
}
