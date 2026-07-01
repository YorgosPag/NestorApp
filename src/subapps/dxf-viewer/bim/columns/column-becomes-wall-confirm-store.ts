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
}

// ─── Module-level state ───────────────────────────────────────────────────────

const CLOSED: ColumnBecomesWallState = {
  open: false,
  aspect: 0,
  longSideMm: 0,
  shortSideMm: 0,
};

let _state: ColumnBecomesWallState = CLOSED;
let _pendingResolve: ((action: ColumnBecomesWallAction) => void) | null = null;
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ανοίγει το confirm dialog «οι διαστάσεις δημιουργούν τοιχίο». Αναστέλλει το
 * commit μέχρι την απόκριση. Επιστρέφει Promise με την επιλογή του χρήστη.
 */
export function requestColumnBecomesWallConfirm(args: {
  aspect: number;
  longSideMm: number;
  shortSideMm: number;
}): Promise<ColumnBecomesWallAction> {
  return new Promise<ColumnBecomesWallAction>((resolve) => {
    _pendingResolve = resolve;
    _state = {
      open: true,
      aspect: args.aspect,
      longSideMm: args.longSideMm,
      shortSideMm: args.shortSideMm,
    };
    _notify();
  });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveColumnBecomesWall(action: ColumnBecomesWallAction): void {
  const resolve = _pendingResolve;
  _pendingResolve = null;
  _state = CLOSED;
  _notify();
  resolve?.(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeColumnBecomesWall(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export function getColumnBecomesWallState(): ColumnBecomesWallState {
  return _state;
}
