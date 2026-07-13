/**
 * ADR-652 M2 — Cloud block items (METADATA only, καμία γεωμετρία).
 *
 * Ό,τι έχει αποθηκευτεί μόνιμα στη βιβλιοθήκη (`block_library` docs), όπως το βλέπει το
 * palette: όνομα / κατηγορία / bounds / provenance / license / `geometryUrl`. Η γεωμετρία
 * ΔΕΝ κατεβαίνει για να ζωγραφιστεί μια κάρτα — κατεβαίνει lazily μόνο όταν ο χρήστης
 * επιλέξει το block για τοποθέτηση (`hydrateCloudBlockDef`). Έτσι μια βιβλιοθήκη με 500
 * blocks ανοίγει ακαριαία (Revit/ArchiCAD browser semantics).
 *
 * Γράφεται από ΕΝΑΝ writer — τον {@link BlockLibraryRegistryHost} (Firestore subscription).
 * Κλειδί = `blklib_*` id. Vanilla store (ADR-040), ίδιος primitive με το in-session registry.
 *
 * @see ../../app/BlockLibraryRegistryHost.tsx — ο μοναδικός writer
 * @see ./block-palette-entries.ts — merge cloud + session για το palette
 */

import { createKeyedVersionedStore } from '@/lib/state/createKeyedVersionedStore';
import type { BlockLibraryItem } from './block-library-types';

const store = createKeyedVersionedStore<BlockLibraryItem>((item) => item.id);

/** Αντικαθιστά ΟΛΟ το snapshot (Firestore subscription → store). */
export function setCloudBlockItems(items: readonly BlockLibraryItem[]): void {
  store.setAll(items);
}

/** Το item με το δοσμένο id, ή `null`. */
export function getCloudBlockItem(id: string): BlockLibraryItem | null {
  return store.get(id);
}

/** Όλα τα cloud items (stable reference μεταξύ αλλαγών). */
export function listCloudBlockItems(): readonly BlockLibraryItem[] {
  return store.list();
}

/** Μονότονο version — bump σε κάθε αλλαγή (subscribe gate). */
export function getCloudBlockItemsVersion(): number {
  return store.getVersion();
}

/** Subscribe σε αλλαγές· επιστρέφει unsubscribe. */
export function subscribeCloudBlockItems(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Test-only reset. */
export function __resetCloudBlockLibraryForTests(): void {
  store.reset();
}
