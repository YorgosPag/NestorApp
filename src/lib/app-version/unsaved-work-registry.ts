/**
 * @fileoverview **«Υπάρχει δουλειά που θα χαθεί αν ανανεωθεί η σελίδα;»** — μητρώο χωρίς React.
 * @related ADR-860 §Ε3β
 * @module lib/app-version/unsaved-work-registry
 *
 * 🔑 **ΓΙΑΤΙ ΧΩΡΙΣ React**: τον ρωτά ο `recovery-coordinator`, που τρέχει **κάτω** από το React
 * (τυλίγει τον φορτωτή chunks του webpack, εγκατεστημένος στο `instrumentation-client.ts` πριν
 * το hydration). Ένα context δεν διαβάζεται από εκεί. Το React **γράφει** εδώ (π.χ. ο
 * `DirtyFormProvider`)· η ανάκαμψη **διαβάζει**.
 *
 * 🔑 **Πάνω στο `createExternalStore`** (`@/lib/state`) — το ΕΝΑ pub/sub της εφαρμογής, όχι
 * δεύτερο χειροποίητο `Set` ακροατών (N.0.2).
 *
 * 🔑 **ΙΔΙΟΚΤΗΤΕΣ, ΟΧΙ ΜΕΤΡΗΤΗΣ**: κάθε πηγή δηλώνεται με δικό της id. Ένας μετρητής θα
 * αποσυντονιζόταν με το πρώτο διπλό `clear` (unmount + cleanup) και θα έλεγε «καθαρό» ενώ μια
 * άλλη φόρμα είναι ακόμη ανοιχτή. Κάθε κλήση είναι **idempotent**: χωρίς πραγματική αλλαγή δεν
 * γίνεται `set`, άρα ούτε ειδοποίηση.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: σήμερα γράφει **μόνο** ο `DirtyFormProvider`, που είναι mounted σε
 * **ένα** σημείο (`RfqDetailClient.tsx`). Κάθε editor με δική του έννοια «μη αποθηκευμένο»
 * (DXF, φόρμες αγγελιών) προσχωρεί **όταν αγγιχτεί** — ADR-860 §6. Διχτάκι ασφαλείας ως τότε:
 * τα native `beforeunload` που ήδη υπάρχουν.
 */

import { createExternalStore } from '@/lib/state/createExternalStore';

const EMPTY: ReadonlySet<string> = new Set();

const store = createExternalStore<ReadonlySet<string>>(EMPTY);

/** Η πηγή `ownerId` έχει μη αποθηκευμένη δουλειά. Idempotent. */
export function markUnsavedWork(ownerId: string): void {
  const owners = store.get();
  if (owners.has(ownerId)) return;
  store.set(new Set([...owners, ownerId]));
}

/** Η πηγή `ownerId` αποθήκευσε ή έκλεισε. Idempotent. */
export function clearUnsavedWork(ownerId: string): void {
  const owners = store.get();
  if (!owners.has(ownerId)) return;
  const next = new Set(owners);
  next.delete(ownerId);
  store.set(next);
}

/** Υπάρχει **οποιαδήποτε** πηγή με μη αποθηκευμένη δουλειά; */
export function hasUnsavedWork(): boolean {
  return store.get().size > 0;
}

/** Ειδοποίηση σε κάθε πραγματική αλλαγή (για `useSyncExternalStore`). Επιστρέφει την απεγγραφή. */
export const subscribeUnsavedWork = store.subscribe;
