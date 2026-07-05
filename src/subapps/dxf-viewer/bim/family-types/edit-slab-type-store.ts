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
 * @see ../../stores/createExternalStore — SSoT pub/sub primitive (notify plumbing)
 */

import { createExternalStore } from '../../stores/createExternalStore';

export interface EditSlabTypeDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
}

const CLOSED: EditSlabTypeDialogState = { open: false, typeId: null };

// Identity-guarded store (`equals: Object.is` = «ίδιο ref → μη notify»· κάθε open/close
// παράγει νέο object, οπότε οι πραγματικές αλλαγές περνούν πάντα).
const store = createExternalStore<EditSlabTypeDialogState>(CLOSED, { equals: Object.is });

/** Open the Edit-Type dialog for a given family type. */
export function openEditSlabType(typeId: string): void {
  store.set({ open: true, typeId });
}

/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export function closeEditSlabType(): void {
  if (!store.get().open) return;
  store.set(CLOSED);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeEditSlabType(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getEditSlabTypeState(): EditSlabTypeDialogState {
  return store.get();
}
