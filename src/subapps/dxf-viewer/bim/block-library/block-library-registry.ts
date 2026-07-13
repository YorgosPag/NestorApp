/**
 * Block Library — registry των ΤΟΠΟΘΕΤΗΣΙΜΩΝ ορισμών (γεωμετρία στη μνήμη).
 *
 * SSoT store για τους {@link InSessionBlockDef} που είναι έτοιμοι για τοποθέτηση. Δύο
 * τροφοδότες, ΕΝΑΣ τόπος:
 *  1. **import** (M1) — τα named blocks του τρέχοντος DXF (`captureSessionBlocksFromScene`).
 *  2. **cloud hydration** (M2) — ένα αποθηκευμένο `BlockLibraryItem` του οποίου το geometry
 *     blob κατέβηκε από το Storage (`hydrateCloudBlockDef`).
 *
 * Έτσι το placement tool έχει ΜΙΑ πηγή γεωμετρίας: ό,τι κι αν διάλεξε ο χρήστης στο
 * palette (session ή cloud), μέχρι να φτάσει στο tool είναι απλώς ένας ορισμός εδώ μέσα —
 * καμία δεύτερη διαδρομή τοποθέτησης.
 *
 * Κλειδί = block name. Δεύτερο import/hydration με ίδιο όνομα → override (τελευταίο κερδίζει).
 * Καθαρά vanilla (ADR-040): μηδέν React state — ο μηχανισμός map+version έρχεται από τον
 * κοινό {@link createKeyedVersionedStore} (ίδιος primitive με το cloud store· όχι δίδυμο).
 *
 * @see ./capture-session-blocks.ts — τροφοδότης #1 (import scene → defs)
 * @see ./hydrate-cloud-block.ts — τροφοδότης #2 (cloud item → def)
 * @see ./block-library-cloud-store.ts — τα cloud METADATA (χωρίς γεωμετρία)
 */

import { createKeyedVersionedStore } from '@/lib/state/createKeyedVersionedStore';
import type { InSessionBlockDef } from './block-library-types';

const store = createKeyedVersionedStore<InSessionBlockDef>((def) => def.name);

/** Αντικαθιστά ΟΛΟ το registry από ένα snapshot (π.χ. μετά από import). */
export function setSessionBlockDefs(list: readonly InSessionBlockDef[]): void {
  store.setAll(list);
}

/** Προσθέτει/ενημερώνει έναν ορισμό (τελευταίο κερδίζει). */
export function upsertSessionBlockDef(def: InSessionBlockDef): void {
  store.upsert(def);
}

/** Ορισμός με το δοσμένο όνομα, ή `null` αν άγνωστο. */
export function getSessionBlockDef(name: string): InSessionBlockDef | null {
  return store.get(name);
}

/** Όλοι οι ορισμοί (σταθερή σειρά εισαγωγής, stable reference μεταξύ αλλαγών). */
export function listSessionBlockDefs(): readonly InSessionBlockDef[] {
  return store.list();
}

/** Μονότονο version — bump σε κάθε αλλαγή (subscribe gate). */
export function getSessionBlockDefsVersion(): number {
  return store.getVersion();
}

/** Subscribe σε αλλαγές· επιστρέφει unsubscribe. */
export function subscribeSessionBlockDefs(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** Καθαρίζει το registry (π.χ. νέο/άδειο σχέδιο). */
export function clearSessionBlockDefs(): void {
  store.clear();
}

/** Test-only reset. */
export function __resetSessionBlockLibraryForTests(): void {
  store.reset();
}
