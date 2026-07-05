// ADR-391 — AdminLayerManager Dialog visibility store SSoT.
// Singleton, zero React. Pattern: CommandLineStore.
// Notify plumbing delegated to the SSoT `createExternalStore` primitive.

import { createExternalStore } from './createExternalStore';

export interface AdminLayerManagerDialogState {
  readonly isOpen: boolean;
}

const CLOSED: AdminLayerManagerDialogState = { isOpen: false };
const OPEN: AdminLayerManagerDialogState = { isOpen: true };

// Identity-guarded store (`equals: Object.is`): `store.get()` stays referentially
// stable between mutations (useSyncExternalStore-safe getSnapshot).
const store = createExternalStore<AdminLayerManagerDialogState>(CLOSED, { equals: Object.is });

export const AdminLayerManagerDialogStore = {
  open(): void {
    if (store.get().isOpen) return;
    store.set(OPEN);
  },

  close(): void {
    if (!store.get().isOpen) return;
    store.set(CLOSED);
  },

  toggle(): void {
    store.set(store.get().isOpen ? CLOSED : OPEN);
  },

  isOpen(): boolean {
    return store.get().isOpen;
  },

  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  getSnapshot(): AdminLayerManagerDialogState {
    return store.get();
  },
};
