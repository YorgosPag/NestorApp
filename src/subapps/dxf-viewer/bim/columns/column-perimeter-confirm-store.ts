/**
 * ADR-363 Φ3c «Κολώνα από περίγραμμα» — confirm-dialog handshake store.
 *
 * Module-level Promise handshake store (mirror του `wall-cascade-delete-store`).
 * Όταν το box-select εντοπίσει ≥1 περίγραμμα που στατικά είναι ΤΟΙΧΙΟ (αναλογία
 * πλευρών ≥ 4 ή μη-ορθογωνικό), η ροή δημιουργίας αναστέλλεται μέχρι ο χρήστης να
 * επιβεβαιώσει/ακυρώσει μέσω του `ColumnPerimeterConfirmDialog`. Το παράθυρο είναι
 * ΕΝΗΜΕΡΩΤΙΚΟ: αναφέρει την αυτόματη ταξινόμηση («N τοιχία + M κολώνες»), ΔΕΝ
 * αναγκάζει ισοπέδωση (Giorgio: μη αλλοίωση στατικών).
 *
 * Pattern: mutable module-level state + () => void subscriber set + stable
 * snapshot getter — συμβατό με useSyncExternalStore (ADR-040 SSoT stores).
 *
 * Invariant: ένα μόνο dialog εκκρεμεί κάθε στιγμή (το box-select είναι σύγχρονο
 * από τη μεριά του χρήστη — δεν μπορεί να ανοίξει δύο μαζί).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 */

export type ColumnPerimeterConfirmAction = 'create' | 'cancel';

export interface ColumnPerimeterConfirmState {
  readonly open: boolean;
  readonly walls: number;
  readonly columns: number;
}

// ─── Module-level state ───────────────────────────────────────────────────────

const CLOSED: ColumnPerimeterConfirmState = { open: false, walls: 0, columns: 0 };

let _state: ColumnPerimeterConfirmState = CLOSED;
let _pendingResolve: ((action: ColumnPerimeterConfirmAction) => void) | null = null;
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Καλείται από τη ροή του εργαλείου όταν εντοπιστούν τοιχία στην επιλογή.
 * Αναστέλλει τη δημιουργία μέχρι την απόκριση του χρήστη.
 */
export function requestColumnPerimeterConfirm(counts: {
  walls: number;
  columns: number;
}): Promise<ColumnPerimeterConfirmAction> {
  return new Promise<ColumnPerimeterConfirmAction>((resolve) => {
    _pendingResolve = resolve;
    _state = { open: true, walls: counts.walls, columns: counts.columns };
    _notify();
  });
}

/** Καλείται από το dialog στο κλικ του χρήστη (Δημιουργία / Άκυρο). */
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
