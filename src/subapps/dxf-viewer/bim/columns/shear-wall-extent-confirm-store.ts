/**
 * ADR-363 §5.6b — «Ασυνήθιστες διαστάσεις τοιχίου» confirm-dialog handshake store.
 *
 * Module-level Promise handshake (mirror του `column-becomes-wall-confirm-store`): όταν ο
 * χρήστης αλλάζει τις διαστάσεις ενός τοιχίου ώστε να ξεπεράσει advisory όριο πάχους/μήκους
 * (βλ. `shear-wall-extents.ts`), αναστέλλουμε το commit και προειδοποιούμε (SOFT — ΠΟΤΕ block):
 *   - 'proceed' → εφαρμογή διαστάσεων ως έχουν (ο χρήστης γνωρίζει).
 *   - 'cancel'  → τίποτα (ESC).
 *
 * Pattern: mutable module-level state + () => void subscriber set + stable snapshot getter —
 * συμβατό με `useSyncExternalStore` (ADR-040 SSoT stores). Ένα μόνο dialog εκκρεμεί κάθε στιγμή.
 *
 * @see ../../ui/dialogs/ShearWallExtentDialog.tsx — ο consumer (self-subscribing portal dialog)
 * @see ./shear-wall-extents.ts — `detectShearWallExtentCrossing`
 * @see ./column-becomes-wall-confirm-store.ts — το precedent pattern
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6b
 */

/** Απόκριση χρήστη: συνέχεια (γνωρίζω) / ακύρωση. */
export type ShearWallExtentAction = 'proceed' | 'cancel';

export interface ShearWallExtentState {
  readonly open: boolean;
  /** Το πάχος (mm) ξεπερνά το advisory όριο. */
  readonly thickTooLarge: boolean;
  /** Το μήκος (mm) ξεπερνά το advisory όριο. */
  readonly lengthTooLarge: boolean;
  /** Μικρή πλευρά (πάχος, mm). */
  readonly thicknessMm: number;
  /** Μεγάλη πλευρά (μήκος, mm). */
  readonly lengthMm: number;
}

// ─── Module-level state ───────────────────────────────────────────────────────

const CLOSED: ShearWallExtentState = {
  open: false,
  thickTooLarge: false,
  lengthTooLarge: false,
  thicknessMm: 0,
  lengthMm: 0,
};

let _state: ShearWallExtentState = CLOSED;
let _pendingResolve: ((action: ShearWallExtentAction) => void) | null = null;
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ανοίγει το confirm dialog «ασυνήθιστες διαστάσεις τοιχίου». Αναστέλλει το commit μέχρι την
 * απόκριση. Επιστρέφει Promise με την επιλογή του χρήστη.
 */
export function requestShearWallExtentConfirm(args: {
  thickTooLarge: boolean;
  lengthTooLarge: boolean;
  thicknessMm: number;
  lengthMm: number;
}): Promise<ShearWallExtentAction> {
  return new Promise<ShearWallExtentAction>((resolve) => {
    _pendingResolve = resolve;
    _state = {
      open: true,
      thickTooLarge: args.thickTooLarge,
      lengthTooLarge: args.lengthTooLarge,
      thicknessMm: args.thicknessMm,
      lengthMm: args.lengthMm,
    };
    _notify();
  });
}

/** Καλείται από το dialog στο κλικ του χρήστη. */
export function resolveShearWallExtent(action: ShearWallExtentAction): void {
  const resolve = _pendingResolve;
  _pendingResolve = null;
  _state = CLOSED;
  _notify();
  resolve?.(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeShearWallExtent(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Ίδια reference μεταξύ αλλαγών. */
export function getShearWallExtentState(): ShearWallExtentState {
  return _state;
}
