/**
 * ADR-674 Φ C — «Edit Opening Hardware» (instance-level) dialog open/close store.
 *
 * Sibling of `edit-opening-type-store.ts` but keyed by `openingId` instead of
 * `typeId` — this dialog edits ONE placed opening's `params.hardwareOverrides`
 * («this door: 4 hinges»), not the shared family type. Does NOT reuse
 * `createEditTypeDialogStore` (ADR-604 Φ2) because that factory's state shape
 * is `{ open, typeId }`; this store's identity key is an entity id, a distinct
 * shape, so a dedicated (but structurally identical) `createExternalStore`
 * instance is the correct SSoT — no shared factory to bend.
 *
 * No Promise handshake — the dialog opens for an `openingId` and closes; the
 * edit itself goes through `useOpeningParamsDispatcher` (undoable command).
 *
 * Invariant: one Edit-Opening-Hardware dialog at a time (user-driven,
 * synchronous open). Identity-guarded (`equals: Object.is`): each open/close
 * produces a new object so real changes always notify, while a redundant
 * close no-ops — mirrors the Edit-Type store's guard.
 *
 * @see ./create-edit-type-dialog-store.ts — sibling TYPE-level factory (ADR-604 Φ2)
 * @see ../../stores/createExternalStore — SSoT pub/sub primitive (notify plumbing)
 * @see ../../ui/ribbon/components/EditOpeningHardwareDialog.tsx
 */

import { createExternalStore } from '../../stores/createExternalStore';

/** Open/close state of the Edit-Opening-Hardware dialog. */
export interface EditOpeningHardwareDialogState {
  readonly open: boolean;
  readonly openingId: string | null;
}

const CLOSED: EditOpeningHardwareDialogState = { open: false, openingId: null };

const store = createExternalStore<EditOpeningHardwareDialogState>(CLOSED, { equals: Object.is });

/** Open the Edit-Opening-Hardware dialog for a given placed opening instance. */
export function openEditOpeningHardware(openingId: string): void {
  store.set({ open: true, openingId });
}

/** Close the dialog (Save committed, or Cancel/overlay-dismiss). */
export function closeEditOpeningHardware(): void {
  if (store.get().open) store.set(CLOSED);
}

/** useSyncExternalStore-compatible subscribe. */
export const subscribeEditOpeningHardware = store.subscribe;

/** useSyncExternalStore-compatible snapshot getter. Same ref between changes. */
export const getEditOpeningHardwareState = store.get;
