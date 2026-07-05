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
 * @see ../../stores/createExternalStore — SSoT pub/sub primitive (notify plumbing)
 */

import { createExternalStore } from '../../stores/createExternalStore';

export interface EditOpeningTypeDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
}

const CLOSED: EditOpeningTypeDialogState = { open: false, typeId: null };

// Identity-guarded store (`equals: Object.is` = «ίδιο ref → μη notify»· κάθε open/close
// παράγει νέο object, οπότε οι πραγματικές αλλαγές περνούν πάντα).
const store = createExternalStore<EditOpeningTypeDialogState>(CLOSED, { equals: Object.is });

/** Open the Edit-Type dialog for a given opening family type. */
export function openEditOpeningType(typeId: string): void {
  store.set({ open: true, typeId });
}

/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export function closeEditOpeningType(): void {
  if (!store.get().open) return;
  store.set(CLOSED);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeEditOpeningType(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getEditOpeningTypeState(): EditOpeningTypeDialogState {
  return store.get();
}
