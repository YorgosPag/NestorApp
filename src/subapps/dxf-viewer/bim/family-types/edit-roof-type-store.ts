/**
 * ADR-417 §10 #3 — «Edit Roof Type» dialog open/close handshake store.
 *
 * Thin binding of the shared `createEditTypeDialogStore` factory (ADR-604 Φ2).
 * Re-exports the four handles under the roof-named identifiers so existing
 * consumers (EditRoofTypeDialog, RibbonRoofFamilyTypeWidget) are unchanged.
 *
 * @see ./create-edit-type-dialog-store.ts — shared factory (ADR-604)
 * @see ../../ui/ribbon/components/EditRoofTypeDialog.tsx
 */

import {
  createEditTypeDialogStore,
  type EditTypeDialogState,
} from './create-edit-type-dialog-store';

/** Open/close state of the Edit-Roof-Type dialog. */
export type EditRoofTypeDialogState = EditTypeDialogState;

const store = createEditTypeDialogStore();

/** Open the Edit-Type dialog for a given roof family type. */
export const openEditRoofType = store.open;
/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export const closeEditRoofType = store.close;
/** useSyncExternalStore-compatible subscribe. */
export const subscribeEditRoofType = store.subscribe;
/** useSyncExternalStore-compatible snapshot getter. Same ref between changes. */
export const getEditRoofTypeState = store.getState;
