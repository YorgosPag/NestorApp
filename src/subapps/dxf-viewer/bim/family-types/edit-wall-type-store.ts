/**
 * ADR-412 Φ5 — «Edit Wall Type» dialog open/close handshake store.
 *
 * Module-level state mirroring `wall-cascade-delete-store` (ADR-040 SSoT store
 * idiom: mutable module state + subscriber set + stable snapshot getter,
 * `useSyncExternalStore`-compatible). No Promise handshake — the dialog just
 * opens for a `typeId` and closes; the edit itself goes through the controller's
 * `updateTypeParams` (undoable command).
 *
 * Invariant: one Edit-Type dialog at a time (user-driven, synchronous open).
 *
 * @see ../../ui/ribbon/components/EditWallTypeDialog.tsx
 */

export interface EditWallTypeDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
}

let _state: EditWallTypeDialogState = { open: false, typeId: null };
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

/** Open the Edit-Type dialog for a given family type. */
export function openEditWallType(typeId: string): void {
  _state = { open: true, typeId };
  _notify();
}

/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export function closeEditWallType(): void {
  if (!_state.open) return;
  _state = { open: false, typeId: null };
  _notify();
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeEditWallType(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getEditWallTypeState(): EditWallTypeDialogState {
  return _state;
}
