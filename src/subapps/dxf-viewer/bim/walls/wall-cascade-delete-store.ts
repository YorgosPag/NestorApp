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

import { createConfirmStore } from '../../stores/createConfirmStore';

export type WallCascadeDeleteAction = 'delete-all' | 'cancel';

export interface WallCascadeDialogState {
  readonly open: boolean;
  readonly openingCount: number;
}

// ─── Module-level state (createConfirmStore SSoT) ─────────────────────────────

const CLOSED: WallCascadeDialogState = { open: false, openingCount: 0 };

const store = createConfirmStore<WallCascadeDialogState, WallCascadeDeleteAction>(CLOSED);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Called by useSmartDelete when orphaned openings are detected.
 * Suspends the delete flow until the user responds via the dialog.
 */
export function requestWallCascadeDelete(openingCount: number): Promise<WallCascadeDeleteAction> {
  return store.request({ open: true, openingCount });
}

/**
 * Called by WallCascadeDeleteDialog on user action (confirm or cancel).
 * Closes the dialog and resolves the pending promise.
 */
export function resolveWallCascadeDelete(action: WallCascadeDeleteAction): void {
  store.resolve(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeWallCascadeDelete(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getWallCascadeDeleteState(): WallCascadeDialogState {
  return store.getSnapshot();
}
