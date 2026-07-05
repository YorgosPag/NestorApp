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
 * @see ../../stores/createExternalStore — SSoT pub/sub primitive (notify plumbing)
 */

import { createExternalStore } from '../../stores/createExternalStore';

export interface EditRoofTypeDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
}

const CLOSED: EditRoofTypeDialogState = { open: false, typeId: null };

// Identity-guarded store (`equals: Object.is` = «ίδιο ref → μη notify»· κάθε open/close
// παράγει νέο object, οπότε οι πραγματικές αλλαγές περνούν πάντα).
const store = createExternalStore<EditRoofTypeDialogState>(CLOSED, { equals: Object.is });

/** Open the Edit-Type dialog for a given family type. */
export function openEditRoofType(typeId: string): void {
  store.set({ open: true, typeId });
}

/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export function closeEditRoofType(): void {
  if (!store.get().open) return;
  store.set(CLOSED);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeEditRoofType(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getEditRoofTypeState(): EditRoofTypeDialogState {
  return store.get();
}
