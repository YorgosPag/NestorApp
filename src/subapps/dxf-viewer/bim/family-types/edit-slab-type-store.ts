/**
 * ADR-412 — «Edit Slab Type» dialog open/close handshake store. Slab analogue of
 * {@link edit-wall-type-store}.
 *
 * Module-level state (ADR-040 SSoT store idiom: mutable module state + subscriber
 * set + stable snapshot getter, `useSyncExternalStore`-compatible). No Promise
 * handshake — the dialog just opens for a `typeId` and closes; the edit itself
 * goes through the controller's undoable command.
 *
 * Invariant: one Edit-Type dialog at a time (user-driven, synchronous open).
 *
 * @see ./edit-wall-type-store.ts — the wall sibling
 */

export interface EditSlabTypeDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
}

let _state: EditSlabTypeDialogState = { open: false, typeId: null };
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

/** Open the Edit-Type dialog for a given family type. */
export function openEditSlabType(typeId: string): void {
  _state = { open: true, typeId };
  _notify();
}

/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export function closeEditSlabType(): void {
  if (!_state.open) return;
  _state = { open: false, typeId: null };
  _notify();
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeEditSlabType(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getEditSlabTypeState(): EditSlabTypeDialogState {
  return _state;
}
