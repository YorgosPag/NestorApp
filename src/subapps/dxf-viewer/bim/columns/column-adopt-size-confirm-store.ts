/**
 * ADR-398 §3.17 — confirm-dialog handshake store για την «υιοθέτηση μεγέθους ορθογωνίου».
 *
 * Module-level Promise handshake (ακριβές mirror του `column-perimeter-confirm-store`): το 1ο κλικ του
 * εργαλείου «Κολόνα» μέσα σε ορθογώνιο DXF αναστέλλει τη δημιουργία και ρωτά τον χρήστη (opt-in, ADR-487
 * §8.4 «ΠΟΤΕ σιωπηλά»):
 *   - 'adopt'   → κολόνα στο μέγεθος + κέντρο + γωνία του ορθογωνίου.
 *   - 'default' → κανονική ροή (default διατομή, 2-κλικ θέση→γωνία).
 *   - 'cancel'  → τίποτα (ESC).
 *
 * Pattern: mutable module-level state + () => void subscriber set + stable snapshot getter — συμβατό με
 * `useSyncExternalStore` (ADR-040 SSoT stores). Ένα μόνο dialog εκκρεμεί κάθε στιγμή (το κλικ είναι
 * σύγχρονο από τη μεριά του χρήστη).
 *
 * @see ../../ui/dialogs/ColumnAdoptSizeDialog.tsx — ο consumer (self-subscribing portal dialog)
 * @see ./column-perimeter-confirm-store.ts — το precedent pattern (ΟΧΙ ίδια ευθύνη → χωριστό store)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.17
 */

/** Απόκριση χρήστη: υιοθέτηση μεγέθους / default διατομή / ακύρωση. */
export type ColumnAdoptSizeAction = 'adopt' | 'default' | 'cancel';

export interface ColumnAdoptSizeState {
  readonly open: boolean;
  /** Πλάτος του ορθογωνίου (mm). */
  readonly widthMm: number;
  /** Βάθος του ορθογωνίου (mm). */
  readonly depthMm: number;
  /** Πλάτος της default διατομής (mm) — για το «ή να κρατήσω το X×Y;». */
  readonly defaultWidthMm: number;
  /** Βάθος της default διατομής (mm). */
  readonly defaultDepthMm: number;
}

// ─── Module-level state ───────────────────────────────────────────────────────

const CLOSED: ColumnAdoptSizeState = {
  open: false,
  widthMm: 0,
  depthMm: 0,
  defaultWidthMm: 0,
  defaultDepthMm: 0,
};

let _state: ColumnAdoptSizeState = CLOSED;
let _pendingResolve: ((action: ColumnAdoptSizeAction) => void) | null = null;
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ανοίγει το confirm dialog «υιοθέτηση μεγέθους». Αναστέλλει τη δημιουργία μέχρι την απόκριση.
 * Επιστρέφει Promise που resolve-άρει με την επιλογή του χρήστη.
 */
export function requestColumnAdoptSizeConfirm(args: {
  widthMm: number;
  depthMm: number;
  defaultWidthMm: number;
  defaultDepthMm: number;
}): Promise<ColumnAdoptSizeAction> {
  return new Promise<ColumnAdoptSizeAction>((resolve) => {
    _pendingResolve = resolve;
    _state = {
      open: true,
      widthMm: args.widthMm,
      depthMm: args.depthMm,
      defaultWidthMm: args.defaultWidthMm,
      defaultDepthMm: args.defaultDepthMm,
    };
    _notify();
  });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveColumnAdoptSize(action: ColumnAdoptSizeAction): void {
  const resolve = _pendingResolve;
  _pendingResolve = null;
  _state = CLOSED;
  _notify();
  resolve?.(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeColumnAdoptSize(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export function getColumnAdoptSizeState(): ColumnAdoptSizeState {
  return _state;
}
