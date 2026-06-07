/**
 * ADR-421 SLICE C — «Edit Opening Type» dialog open/close handshake store.
 *
 * Module-level state mirroring `edit-wall-type-store` (ADR-040 SSoT store idiom:
 * mutable module state + subscriber set + stable snapshot getter,
 * `useSyncExternalStore`-compatible). No Promise handshake — the dialog opens for
 * a `typeId` and closes; the edit itself goes through the controller's
 * `updateTypeParams` (undoable command).
 *
 * Invariant: one Edit-Type dialog at a time (user-driven, synchronous open).
 *
 * @see ../../ui/ribbon/components/EditOpeningTypeDialog.tsx
 */

export interface EditOpeningTypeDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
}

let _state: EditOpeningTypeDialogState = { open: false, typeId: null };
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

/** Open the Edit-Type dialog for a given opening family type. */
export function openEditOpeningType(typeId: string): void {
  _state = { open: true, typeId };
  _notify();
}

/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export function closeEditOpeningType(): void {
  if (!_state.open) return;
  _state = { open: false, typeId: null };
  _notify();
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeEditOpeningType(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getEditOpeningTypeState(): EditOpeningTypeDialogState {
  return _state;
}
