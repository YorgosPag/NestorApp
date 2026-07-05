/**
 * ADR-363 §5.6 — «Οι διαστάσεις δημιουργούν τοιχίο» confirm-dialog handshake store.
 *
 * Module-level Promise handshake (ακριβές mirror του `column-adopt-size-confirm-store`):
 * όταν ο χρήστης αλλάζει τις διαστάσεις μιας **ορθογώνιας** κολόνας ώστε η νέα
 * αναλογία πλευρών να περνά το κατώφλι κολόνα→τοιχίο (EC2 §9.6.1 / EC8 §5.4.2.4,
 * rounded aspect > 4), αναστέλλουμε το commit και ρωτάμε (Revit-style warn, ΟΧΙ
 * hard-block):
 *   - 'convert' → εφαρμογή διαστάσεων + reclassify σε `shear-wall` (χάνει
 *                 ιδιότητες κολόνας, αποκτά τοιχίου).
 *   - 'keep'    → εφαρμογή διαστάσεων, μένει `rectangular` (Revit «κρατά family»).
 *   - 'cancel'  → τίποτα (ESC).
 *
 * Pattern: mutable module-level state + () => void subscriber set + stable
 * snapshot getter — συμβατό με `useSyncExternalStore` (ADR-040 SSoT stores). Ένα
 * μόνο dialog εκκρεμεί κάθε στιγμή (η αλλαγή διάστασης είναι σύγχρονη από τη
 * μεριά του χρήστη — δεν ανοίγουν δύο μαζί).
 *
 * @see ../../ui/dialogs/ColumnBecomesWallDialog.tsx — ο consumer (self-subscribing portal dialog)
 * @see ./column-aspect.ts — `detectRectColumnBecomesWall` / `reclassifyRectToShearWall`
 * @see ./column-adopt-size-confirm-store.ts — το precedent pattern
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

/** Απόκριση χρήστη: μετατροπή σε τοιχίο / κράτα κολόνα / ακύρωση. */
export type ColumnBecomesWallAction = 'convert' | 'keep' | 'cancel';

export interface ColumnBecomesWallState {
  readonly open: boolean;
  /** Στρογγυλεμένο aspect (> 4) της νέας διατομής. */
  readonly aspect: number;
  /** Μεγάλη πλευρά (mm) της νέας διατομής. */
  readonly longSideMm: number;
  /** Μικρή πλευρά (mm) της νέας διατομής. */
  readonly shortSideMm: number;
  /**
   * ADR-363 §5.6c — true ΜΟΝΟ για ορθογώνιο (μόνο αυτό μετατρέπεται σε shear-wall) → δείξε το κουμπί
   * «Μετατροπή σε τοιχίο». false (Γ/Τ/Π/Ι/σύνθετη) → advisory-only (Συνέχεια / Άκυρο, κρατά το σχήμα).
   */
  readonly canReclassify: boolean;
}

// ─── Module-level state ───────────────────────────────────────────────────────

const CLOSED: ColumnBecomesWallState = {
  open: false,
  aspect: 0,
  longSideMm: 0,
  shortSideMm: 0,
  canReclassify: false,
};

const store = createConfirmStore<ColumnBecomesWallState, ColumnBecomesWallAction>(CLOSED);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ανοίγει το confirm dialog «οι διαστάσεις δημιουργούν τοιχίο». Αναστέλλει το
 * commit μέχρι την απόκριση. Επιστρέφει Promise με την επιλογή του χρήστη.
 */
export function requestColumnBecomesWallConfirm(args: {
  aspect: number;
  longSideMm: number;
  shortSideMm: number;
  canReclassify: boolean;
}): Promise<ColumnBecomesWallAction> {
  return store.request({
    open: true,
    aspect: args.aspect,
    longSideMm: args.longSideMm,
    shortSideMm: args.shortSideMm,
    canReclassify: args.canReclassify,
  });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveColumnBecomesWall(action: ColumnBecomesWallAction): void {
  store.resolve(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeColumnBecomesWall(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export function getColumnBecomesWallState(): ColumnBecomesWallState {
  return store.getSnapshot();
}
