/**
 * ADR-412 — «Edit Slab Type» dialog open/close handshake store.
 *
 * Thin binding of the shared `createEditTypeDialogStore` factory (ADR-603 Φ2).
 * Re-exports the four handles under the slab-named identifiers so existing
 * consumers (EditSlabTypeDialog, RibbonSlabFamilyTypeWidget) are unchanged.
 *
 * @see ./create-edit-type-dialog-store.ts — shared factory (ADR-603)
 * @see ../../ui/ribbon/components/EditSlabTypeDialog.tsx
 */

import {
  createEditTypeDialogStore,
  type EditTypeDialogState,
} from './create-edit-type-dialog-store';

/** Open/close state of the Edit-Slab-Type dialog. */
export type EditSlabTypeDialogState = EditTypeDialogState;

const store = createEditTypeDialogStore();

/** Open the Edit-Type dialog for a given slab family type. */
export const openEditSlabType = store.open;
/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export const closeEditSlabType = store.close;
/** useSyncExternalStore-compatible subscribe. */
export const subscribeEditSlabType = store.subscribe;
/** useSyncExternalStore-compatible snapshot getter. Same ref between changes. */
export const getEditSlabTypeState = store.getState;
