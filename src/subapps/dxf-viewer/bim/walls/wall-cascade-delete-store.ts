/**
 * ADR-363 Phase cascade-delete — Wall cascade-delete dialog handshake store.
 *
 * Module-level Promise handshake store. When useSmartDelete detects that
 * a wall being deleted has child openings, it calls `requestWallCascadeDelete`
 * which suspends the delete flow until the user confirms or cancels via
 * `WallCascadeDeleteDialog`.
 *
 * Pattern mirrors HoverStore / ImmediatePositionStore (ADR-040 SSoT stores):
 * mutable module-level state + () => void subscriber set + stable snapshot getter.
 * Compatible with useSyncExternalStore.
 *
 * Invariant: only one cascade-delete dialog can be pending at a time (wall
 * deletion is synchronous on the user side — they cannot trigger two at once).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

export type WallCascadeDeleteAction = 'delete-all' | 'cancel';

export interface WallCascadeDialogState {
  readonly open: boolean;
  readonly openingCount: number;
}

// ─── Module-level state ───────────────────────────────────────────────────────

let _state: WallCascadeDialogState = { open: false, openingCount: 0 };
let _pendingResolve: ((action: WallCascadeDeleteAction) => void) | null = null;
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called by useSmartDelete when orphaned openings are detected.
 * Suspends the delete flow until the user responds via the dialog.
 */
export function requestWallCascadeDelete(openingCount: number): Promise<WallCascadeDeleteAction> {
  return new Promise<WallCascadeDeleteAction>((resolve) => {
    _pendingResolve = resolve;
    _state = { open: true, openingCount };
    _notify();
  });
}

/**
 * Called by WallCascadeDeleteDialog on user action (confirm or cancel).
 * Closes the dialog and resolves the pending promise.
 */
export function resolveWallCascadeDelete(action: WallCascadeDeleteAction): void {
  const resolve = _pendingResolve;
  _pendingResolve = null;
  _state = { open: false, openingCount: 0 };
  _notify();
  resolve?.(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeWallCascadeDelete(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getWallCascadeDeleteState(): WallCascadeDialogState {
  return _state;
}
