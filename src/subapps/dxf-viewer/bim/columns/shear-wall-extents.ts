/**
 * ADR-363 §5.6b — Δομικό μέλος (κολόνα/τοιχίο, ΚΑΘΕ τύπος): SOFT όρια πάχους/μήκους (advisory, ΠΟΤΕ block).
 *
 * Pure SSoT για τον έλεγχο «ασυνήθιστων» διαστάσεων. Οι Ευρωκώδικες (EC2/EC8) ΔΕΝ ορίζουν μέγιστο
 * πάχος ή μήκος — μόνο ΕΛΑΧΙΣΤΑ (`MIN_SHEAR_WALL_THICKNESS_MM`) + απαιτήσεις οπλισμού· οι μεγάλοι
 * (Revit/ETABS/Tekla) δεν βάζουν hard cap. Άρα εδώ **δεν μπλοκάρουμε ποτέ** — απλώς προειδοποιούμε
 * (🟠 πορτοκαλί ghost + confirm) όταν το μέλος βγαίνει εκτός τυπικού εύρους:
 *   - πάχος > `MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM` (1.5m) → «μαζικό σκυρόδεμα».
 *   - μήκος > `MAX_TYPICAL_SHEAR_WALL_LENGTH_MM` (30m) → απαιτείται αρμός διαστολής (ρηγμάτωση EC2 §7.3).
 *
 * thickness = μικρή πλευρά, length = μεγάλη πλευρά του bounding box (order-agnostic min/max, όπως ο aspect)
 * → ισχύει για ΚΑΘΕ τύπο διατομής (Γ/Τ/Π/Ι/σύνθετη/ορθογώνιο/τοιχίο), όχι μόνο shear-wall (§5.6c B, Giorgio:
 * «όταν μεγαλώνω πολύ το σκέλος ενός Τ, θέλω κι εκεί το μήνυμα αρμού διαστολής όπως στις ορθογώνιες»).
 * Εξαιρούνται τα συμμετρικά (circular/polygon — width≈depth, δεν έχουν «μήκος»).
 *
 * @see ./column-aspect.ts — αδελφός detector (επιμήκυνση→σαν τοιχίο βάσει aspect)
 * @see ./shear-wall-extent-confirm-store.ts — edit-time warn store
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6b / §5.6c B
 */

import {
  MAX_TYPICAL_SHEAR_WALL_LENGTH_MM,
  MAX_TYPICAL_SHEAR_WALL_THICKNESS_MM,
  type ColumnParams,
} from '../types/column-types';

/** Πληροφορία της προειδοποίησης (ποια διάσταση ξεπερνά + οι τιμές, για το μήνυμα). */
export interface MemberExtentWarning {
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

/** Τα συμμετρικά (κύκλος/κανονικό πολύγωνο) δεν έχουν έννοια «μήκους/πάχους» → εκτός extent scope. */
function isSymmetricKind(p: ColumnParams): boolean {
  return p.kind === 'circular' || p.kind === 'polygon';
}

/**
 * Edit-time φύλακας: επιστρέφει non-null ΜΟΝΟ όταν ένα δομικό μέλος **ΟΠΟΙΟΥΔΗΠΟΤΕ τύπου** (εκτός
 * circular/polygon), μετά την αλλαγή διαστάσεων, ξεπερνά για ΠΡΩΤΗ φορά κάποιο advisory όριο του
 * bounding box (πάχος > 1.5m ή μήκος > 30m):
 *   - next: μη-συμμετρικό, πάχος > 1.5m ή μήκος > 30m
 *   - το prev ΔΕΝ ξεπερνούσε ήδη το ΙΔΙΟ όριο (καμία επανα-ειδοποίηση σε επόμενα edits).
 * Επιστρέφει `null` όταν το next είναι συμμετρικό (κύκλος/πολύγωνο), ή δεν υπάρχει ΝΕΑ υπέρβαση.
 * (§5.6c B — γενικεύθηκε από shear-wall-only ώστε π.χ. ένα επίμηκες Τ/Γ να παίρνει κι αυτό το μήνυμα αρμού.)
 */
export function detectMemberExtentCrossing(
  prev: ColumnParams,
  next: ColumnParams,
): MemberExtentWarning | null {
  if (isSymmetricKind(next)) return null;
  const nextEx = isShearWallExtentExceeded(next);
  if (!nextEx.thick && !nextEx.length) return null;
  // prev-ήδη-εκτός στην ΙΔΙΑ διάσταση → όχι νέα υπέρβαση (μη νοχλείς ξανά).
  const prevEx = isSymmetricKind(prev)
    ? { thick: false, length: false }
    : isShearWallExtentExceeded(prev);
  const newThick = nextEx.thick && !prevEx.thick;
  const newLength = nextEx.length && !prevEx.length;
  if (!newThick && !newLength) return null;
  const { thicknessMm, lengthMm } = wallThicknessLength(next);
  return { thickTooLarge: nextEx.thick, lengthTooLarge: nextEx.length, thicknessMm, lengthMm };
}
