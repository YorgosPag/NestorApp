/**
 * ADR-421 SLICE C — «Edit Opening Type» dialog open/close handshake store.
 *
 * Thin binding of the shared `createEditTypeDialogStore` factory (ADR-604 Φ2).
 * Re-exports the four handles under the opening-named identifiers so existing
 * consumers (EditOpeningTypeDialog, RibbonOpeningTypePropertiesWidget) are
 * unchanged.
 *
 * @see ./create-edit-type-dialog-store.ts — shared factory (ADR-604)
 * @see ../../ui/ribbon/components/EditOpeningTypeDialog.tsx
 */

import {
  createEditTypeDialogStore,
  type EditTypeDialogState,
} from './create-edit-type-dialog-store';

/** Open/close state of the Edit-Opening-Type dialog. */
export type EditOpeningTypeDialogState = EditTypeDialogState;

const store = createEditTypeDialogStore();

/** Open the Edit-Type dialog for a given opening family type. */
export const openEditOpeningType = store.open;
/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export const closeEditOpeningType = store.close;
/** useSyncExternalStore-compatible subscribe. */
export const subscribeEditOpeningType = store.subscribe;
/** useSyncExternalStore-compatible snapshot getter. Same ref between changes. */
export const getEditOpeningTypeState = store.getState;
