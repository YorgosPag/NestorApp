/**
 * ADR-651 Φάση Θ — τα **αποθηκευμένα** πρότυπα πινακίδας (γραφείου / έργου / δικά μου), όπως
 * τα βλέπει το εργαλείο τη στιγμή του κλικ.
 *
 * **Γιατί store και όχι hook**: το `active-title-block.ts` λύνει το πρότυπο **event-time**
 * (στο κλικ, στο ghost, στο PDF) — μηδέν `await`, μηδέν React συνδρομή στο commit path
 * (ADR-040). Άρα η βιβλιοθήκη πρέπει να διαβάζεται **σύγχρονα** από module singleton, ακριβώς
 * όπως το `block-library-cloud-store` (ίδιος primitive: `createKeyedVersionedStore`).
 *
 * **Ένας writer**: ο {@link TitleBlockLibraryHost} (Firestore subscription μέσω του
 * `ScopedLibraryService`). Επειδή η συνδρομή είναι **ζωντανή**, μια αλλαγή στο πρότυπο του
 * γραφείου φτάνει εδώ μόνη της ⇒ **αλλάζω το master → ενημερώνονται όλα τα φύλλα** (ArchiCAD
 * Master Layout), χωρίς refresh και χωρίς αντίγραφα.
 *
 * Χαμηλή συχνότητα (αλλάζει μόνο όταν κάποιος σώζει πρότυπο) ⇒ το ribbon μπορεί άφοβα να
 * κάνει `useSyncExternalStore` πάνω του (δεν είναι high-freq store — ADR-040 CHECK 6C).
 *
 * @see ../../app/TitleBlockLibraryHost.tsx — ο μοναδικός writer
 * @see ./active-title-block.ts — ο event-time καταναλωτής
 */

import { createKeyedVersionedStore } from '@/lib/state/createKeyedVersionedStore';
import type { TextTemplate } from '../templates/template.types';

const store = createKeyedVersionedStore<TextTemplate>((template) => template.id);

/** Αντικαθιστά ΟΛΟ το snapshot (Firestore subscription → store). Μόνο `title-block` πρότυπα. */
export function setTitleBlockLibrary(templates: readonly TextTemplate[]): void {
  store.setAll(templates.filter((template) => template.category === 'title-block'));
}

/** Το αποθηκευμένο πρότυπο με αυτό το id, ή `null` (event-time read). */
export function getTitleBlockLibraryTemplate(id: string): TextTemplate | null {
  return store.get(id);
}

/** Όλα τα αποθηκευμένα πρότυπα πινακίδας (stable reference μεταξύ αλλαγών). */
export function listTitleBlockLibrary(): readonly TextTemplate[] {
  return store.list();
}

/** Μονότονο version — το subscribe gate του ribbon. */
export function getTitleBlockLibraryVersion(): number {
  return store.getVersion();
}

export function subscribeTitleBlockLibrary(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Test-only reset. */
export function __resetTitleBlockLibraryForTests(): void {
  store.reset();
}
