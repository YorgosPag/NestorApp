// ADR-686 Φ5 — ορατότητα του dialog «Αντιστοίχιση Υλικών» (Revit-style Material Mapping) για ένα
// εισαγόμενο μοντέλο. Singleton, zero React. Pattern: ImportedMeshBoqDialogStore.
//
// Κρατά το `entityId` της οντότητας-άγκυρας (ένα κομμάτι του μοντέλου): το dialog ανοίγει από
// ribbon action πάνω στην τρέχουσα επιλογή, και το μοντέλο υπό επεξεργασία (όλα τα κομμάτια του
// ίδιου `uploadId`) πρέπει να μείνει καρφωμένο όσο είναι ανοιχτό. Χωρίς αυτό, μια αλλαγή επιλογής
// με ανοιχτό dialog θα άλλαζε σιωπηλά το μοντέλο που ο χρήστης νομίζει ότι επεξεργάζεται.

import { createExternalStore } from './createExternalStore';

export interface ImportedMeshMaterialMapDialogState {
  /** Η οντότητα-άγκυρα (ένα κομμάτι)· `null` όταν το dialog είναι κλειστό. Το `uploadId` της
   * ομαδοποιεί όλα τα αδέλφια-κομμάτια στον host. */
  readonly entityId: string | null;
}

const CLOSED: ImportedMeshMaterialMapDialogState = { entityId: null };

const store = createExternalStore<ImportedMeshMaterialMapDialogState>(CLOSED, { equals: Object.is });

export const ImportedMeshMaterialMapDialogStore = {
  open(entityId: string): void {
    if (!entityId || store.get().entityId === entityId) return;
    store.set({ entityId });
  },

  close(): void {
    if (store.get().entityId === null) return;
    store.set(CLOSED);
  },

  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  getSnapshot(): ImportedMeshMaterialMapDialogState {
    return store.get();
  },
};
