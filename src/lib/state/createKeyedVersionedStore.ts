/**
 * createKeyedVersionedStore — keyed collection store με μονότονο version + stable snapshot.
 *
 * Το μοτίβο «Map + version signal + subscribe» εμφανίστηκε ταυτόχρονα σε δύο σημεία της
 * Block Library (in-session defs από το import ΚΑΙ cloud items από το Firestore, ADR-652
 * M2). Αντί για δύο πανομοιότυπα stores (sibling clone — ακριβώς ό,τι απαγορεύει ο N.18),
 * ΕΝΑΣ primitive εδώ, δίπλα στο {@link createExternalStore}, τον οποίο τυλίγουν typed
 * wrappers ανά domain.
 *
 * ⚠️ Stable snapshot: το `list()` επιστρέφει την ΙΔΙΑ αναφορά πίνακα όσο δεν αλλάζει το
 * περιεχόμενο. Χωρίς αυτό, το `useSyncExternalStore` θα έβλεπε νέο array σε κάθε render και
 * θα έμπαινε σε άπειρο loop — γι' αυτό ο πίνακας υπολογίζεται lazily και ακυρώνεται μόνο
 * σε πραγματική μεταβολή.
 *
 * React-free / vanilla (ADR-040): μηδέν React state, ασφαλές για workers + event-time reads.
 *
 * @see ./createExternalStore — ο version signal που χρησιμοποιεί από κάτω
 */

import { createExternalStore } from './createExternalStore';

export interface KeyedVersionedStore<T> {
  /** Αντικαθιστά ΟΛΟ το περιεχόμενο (π.χ. snapshot από subscription). */
  setAll(items: readonly T[]): void;
  /** Προσθέτει/ενημερώνει ένα στοιχείο (last-wins ανά key). */
  upsert(item: T): void;
  /** Στοιχείο με το δοσμένο key, ή `null`. */
  get(key: string): T | null;
  /** Όλα τα στοιχεία (σειρά εισαγωγής, STABLE reference μεταξύ αλλαγών). */
  list(): readonly T[];
  /** Μονότονο version — bump σε κάθε μεταβολή. */
  getVersion(): number;
  /** Subscribe σε μεταβολές· επιστρέφει unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Αδειάζει το store (no-op αν είναι ήδη άδειο). */
  clear(): void;
  /** Test-only reset (version → 0). */
  reset(): void;
}

export function createKeyedVersionedStore<T>(keyOf: (item: T) => string): KeyedVersionedStore<T> {
  const items = new Map<string, T>();
  const versionSignal = createExternalStore<number>(0);
  let snapshot: readonly T[] | null = null;

  function emit(): void {
    snapshot = null; // invalidate — ο επόμενος list() ξαναχτίζει
    versionSignal.set(versionSignal.get() + 1);
  }

  return {
    setAll(list) {
      items.clear();
      for (const item of list) items.set(keyOf(item), item);
      emit();
    },
    upsert(item) {
      items.set(keyOf(item), item);
      emit();
    },
    get(key) {
      return items.get(key) ?? null;
    },
    list() {
      if (snapshot === null) snapshot = [...items.values()];
      return snapshot;
    },
    getVersion() {
      return versionSignal.get();
    },
    subscribe(listener) {
      return versionSignal.subscribe(listener);
    },
    clear() {
      if (items.size === 0) return;
      items.clear();
      emit();
    },
    reset() {
      items.clear();
      snapshot = null;
      versionSignal.reset(0);
    },
  };
}
