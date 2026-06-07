/**
 * ADR-363 Φ3c / ADR-419 «Πολλαπλή δημιουργία» — confirm-dialog handshake store.
 *
 * Module-level Promise handshake store (mirror του `wall-cascade-delete-store`).
 * Δύο modes:
 *   - `intent-mixed` (ADR-419): η «Πολλαπλή δημιουργία κολωνών/τοιχίων» εντόπισε
 *     ΚΑΙ στοιχεία «άλλου τύπου» από την πρόθεση του χρήστη. Ρωτάμε αν θα
 *     δημιουργηθούν κι αυτά (3 κουμπιά: όλα / μόνο τα δικά μου / άκυρο· 2 κουμπιά
 *     όταν δεν βρέθηκε κανένα «δικό μου»). Σέβεται την πρόθεση + μη αλλοίωση στατικών.
 *   - `is-column` (Φ3): ο χρήστης ζήτησε «Τοιχίο από περίγραμμα» αλλά η αναλογία
 *     πλευρών ≤ 4 → EC2 §9.6.1 = κολόνα. Ρωτάμε πριν δημιουργήσουμε.
 *
 * Pattern: mutable module-level state + () => void subscriber set + stable
 * snapshot getter — συμβατό με useSyncExternalStore (ADR-040 SSoT stores).
 *
 * Invariant: ένα μόνο dialog εκκρεμεί κάθε στιγμή (το box-select/click είναι
 * σύγχρονο από τη μεριά του χρήστη — δεν μπορεί να ανοίξει δύο μαζί).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

/**
 * Απόκριση χρήστη:
 *   - 'create-all'     → δημιουργία primary + secondary.
 *   - 'create-primary' → δημιουργία ΜΟΝΟ της πρόθεσης (intent-mixed, ≥1 primary).
 *   - 'cancel'         → τίποτα.
 * (is-column: το κουμπί δημιουργίας επιστρέφει 'create-all'.)
 */
export type ColumnPerimeterConfirmAction = 'create-all' | 'create-primary' | 'cancel';

export type ColumnPerimeterConfirmMode = 'intent-mixed' | 'is-column';

/** Πρόθεση χρήστη στο «Πολλαπλή δημιουργία» (ποιο κουμπί κορδέλας πατήθηκε). */
export type ColumnDiscreteIntent = 'columns' | 'walls';

export interface ColumnPerimeterConfirmState {
  readonly open: boolean;
  readonly mode: ColumnPerimeterConfirmMode;
  /** intent-mixed — η πρόθεση (κολώνες ή τοιχία). */
  readonly intent: ColumnDiscreteIntent;
  /** intent-mixed — πλήθος στοιχείων που ταιριάζουν στην πρόθεση. */
  readonly primaryCount: number;
  /** intent-mixed — πλήθος στοιχείων «άλλου τύπου» που εντοπίστηκαν. */
  readonly secondaryCount: number;
  /** is-column — αναλογία πλευρών (0 στο intent-mixed). */
  readonly aspect: number;
}

// ─── Module-level state ───────────────────────────────────────────────────────

const CLOSED: ColumnPerimeterConfirmState = {
  open: false,
  mode: 'intent-mixed',
  intent: 'columns',
  primaryCount: 0,
  secondaryCount: 0,
  aspect: 0,
};

let _state: ColumnPerimeterConfirmState = CLOSED;
let _pendingResolve: ((action: ColumnPerimeterConfirmAction) => void) | null = null;
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * ADR-419 — «Πολλαπλή δημιουργία»: εντοπίστηκαν στοιχεία «άλλου τύπου» από την
 * πρόθεση. Αναστέλλει τη δημιουργία μέχρι την απόκριση του χρήστη.
 */
export function requestColumnDiscreteIntentConfirm(args: {
  intent: ColumnDiscreteIntent;
  primaryCount: number;
  secondaryCount: number;
}): Promise<ColumnPerimeterConfirmAction> {
  return new Promise<ColumnPerimeterConfirmAction>((resolve) => {
    _pendingResolve = resolve;
    _state = {
      open: true,
      mode: 'intent-mixed',
      intent: args.intent,
      primaryCount: args.primaryCount,
      secondaryCount: args.secondaryCount,
      aspect: 0,
    };
    _notify();
  });
}

/**
 * Ανοίγει το dialog «is-column» — ο χρήστης χρησιμοποίησε «Τοιχίο από περίγραμμα»
 * αλλά η αναλογία πλευρών της διατομής είναι ≤ 4 (EC2 §9.6.1 = κολόνα). Ρωτάμε
 * τι να δημιουργήσουμε πριν προχωρήσουμε.
 * - 'create-all' → δημιουργία κολόνας (ορθογωνική, σωστή κλάση κατά κανόνα)
 * - 'cancel' → ακύρωση
 */
export function requestColumnIsColumnWarn(aspect: number): Promise<ColumnPerimeterConfirmAction> {
  return new Promise<ColumnPerimeterConfirmAction>((resolve) => {
    _pendingResolve = resolve;
    _state = {
      open: true,
      mode: 'is-column',
      intent: 'columns',
      primaryCount: 0,
      secondaryCount: 0,
      aspect,
    };
    _notify();
  });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveColumnPerimeterConfirm(action: ColumnPerimeterConfirmAction): void {
  const resolve = _pendingResolve;
  _pendingResolve = null;
  _state = CLOSED;
  _notify();
  resolve?.(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeColumnPerimeterConfirm(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export function getColumnPerimeterConfirmState(): ColumnPerimeterConfirmState {
  return _state;
}
