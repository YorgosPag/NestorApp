/**
 * ADR-412 Φ5 — «Edit Wall Type» dialog open/close handshake store.
 *
 * Thin binding of the shared `createEditTypeDialogStore` factory (ADR-603 Φ2).
 * Re-exports the four handles under the wall-named identifiers so existing
 * consumers (EditWallTypeDialog, RibbonWallTypePropertiesWidget) are unchanged.
 *
 * @see ./create-edit-type-dialog-store.ts — shared factory (ADR-603)
 * @see ../../ui/ribbon/components/EditWallTypeDialog.tsx
 */

import {
  createEditTypeDialogStore,
  type EditTypeDialogState,
} from './create-edit-type-dialog-store';

/** Open/close state of the Edit-Wall-Type dialog. */
export type EditWallTypeDialogState = EditTypeDialogState;

const store = createEditTypeDialogStore();

/** Open the Edit-Type dialog for a given wall family type. */
export const openEditWallType = store.open;
/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export const closeEditWallType = store.close;
/** useSyncExternalStore-compatible subscribe. */
export const subscribeEditWallType = store.subscribe;
/** useSyncExternalStore-compatible snapshot getter. Same ref between changes. */
export const getEditWallTypeState = store.getState;
