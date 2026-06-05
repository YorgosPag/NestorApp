/**
 * ADR-417 §10 #3 — «Edit Roof Type» dialog open/close handshake store. Roof
 * analogue of {@link edit-slab-type-store}.
 *
 * Module-level state (ADR-040 SSoT store idiom: mutable module state + subscriber
 * set + stable snapshot getter, `useSyncExternalStore`-compatible). No Promise
 * handshake — the dialog just opens for a `typeId` and closes; the edit itself
 * goes through the controller's undoable command.
 *
 * Invariant: one Edit-Type dialog at a time (user-driven, synchronous open).
 *
 * @see ./edit-slab-type-store.ts — the slab sibling
 */

export interface EditRoofTypeDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
}

let _state: EditRoofTypeDialogState = { open: false, typeId: null };
const _subs = new Set<() => void>();

function _notify(): void {
  _subs.forEach((cb) => cb());
}

/** Open the Edit-Type dialog for a given family type. */
export function openEditRoofType(typeId: string): void {
  _state = { open: true, typeId };
  _notify();
}

/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export function closeEditRoofType(): void {
  if (!_state.open) return;
  _state = { open: false, typeId: null };
  _notify();
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeEditRoofType(cb: () => void): () => void {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getEditRoofTypeState(): EditRoofTypeDialogState {
  return _state;
}
