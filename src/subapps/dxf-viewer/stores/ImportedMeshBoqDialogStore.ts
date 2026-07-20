// ADR-683 Φ3.1β — ορατότητα του dialog ανάθεσης προμέτρησης (εισαγόμενο πλέγμα).
// Singleton, zero React. Pattern: AdminLayerManagerDialogStore.
//
// Κρατά ΚΑΙ το `entityId`: το dialog ανοίγει από ribbon action πάνω στην τρέχουσα επιλογή, και το
// αντικείμενο της επεξεργασίας πρέπει να μείνει καρφωμένο όσο είναι ανοιχτό. Χωρίς αυτό, μια αλλαγή
// επιλογής με ανοιχτό dialog θα έγραφε την ταυτότητα σε ΑΛΛΟ πλέγμα — σιωπηλά και μη αναστρέψιμα
// για τον χρήστη, που θα νόμιζε ότι κοστολόγησε αυτό που έβλεπε.

import { createExternalStore } from './createExternalStore';

export interface ImportedMeshBoqDialogState {
  /** Το πλέγμα υπό επεξεργασία· `null` όταν το dialog είναι κλειστό. */
  readonly entityId: string | null;
}

const CLOSED: ImportedMeshBoqDialogState = { entityId: null };

const store = createExternalStore<ImportedMeshBoqDialogState>(CLOSED, { equals: Object.is });

export const ImportedMeshBoqDialogStore = {
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

  getSnapshot(): ImportedMeshBoqDialogState {
    return store.get();
  },
};
