/**
 * ADR-412 Φ5 — «Delete Wall Type» warn dialog handshake store (Q6).
 *
 * Module-level Promise handshake mirroring `wall-cascade-delete-store`: the
 * controller's delete flow calls `requestFamilyTypeDelete` and suspends until the
 * user confirms (→ detach instances + delete type) or cancels via
 * `BimFamilyTypeDeleteDialog`. `useSyncExternalStore`-compatible.
 *
 * Non-destructive: confirming detaches instances (they keep their current
 * dimensions) — never deletes geometry.
 *
 * @see ../../ui/dialogs/BimFamilyTypeDeleteDialog.tsx
 * @see ../walls/wall-cascade-delete-store.ts — sibling pattern
 */

import { createConfirmStore } from '../../stores/createConfirmStore';

export type FamilyTypeDeleteAction = 'delete-and-detach' | 'cancel';

export interface FamilyTypeDeleteDialogState {
  readonly open: boolean;
  readonly typeId: string | null;
  /** Instances of the type on the CURRENT scene (drives warn copy). */
  readonly affectedCount: number;
}

const CLOSED: FamilyTypeDeleteDialogState = { open: false, typeId: null, affectedCount: 0 };

const store = createConfirmStore<FamilyTypeDeleteDialogState, FamilyTypeDeleteAction>(CLOSED);

/** Open the warn dialog and suspend the delete flow until the user responds. */
export function requestFamilyTypeDelete(
  args: { typeId: string; affectedCount: number },
): Promise<FamilyTypeDeleteAction> {
  return store.request({ open: true, typeId: args.typeId, affectedCount: args.affectedCount });
}

/** Called by the dialog buttons — closes + resolves the pending promise. */
export function resolveFamilyTypeDelete(action: FamilyTypeDeleteAction): void {
  store.resolve(action);
}

/** useSyncExternalStore-compatible subscribe. */
export function subscribeFamilyTypeDelete(cb: () => void): () => void {
  return store.subscribe(cb);
}

/** useSyncExternalStore-compatible snapshot getter. Same reference between changes. */
export function getFamilyTypeDeleteState(): FamilyTypeDeleteDialogState {
  return store.getSnapshot();
}
