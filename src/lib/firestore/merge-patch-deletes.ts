/**
 * @fileoverview **RFC 7396 → Firestore** — το `null` μιας μερικής ενημέρωσης γίνεται `FieldValue.delete()`, σε ΕΝΑ σημείο.
 * @module lib/firestore/merge-patch-deletes
 * @see ADR-249 §7.8 — άδειασμα πεδίου ακινήτου (κλειστό σύνολο πεδίων-δηλώσεων)
 * @see RFC 7396 (JSON Merge Patch: `null` = «αφαίρεσε») · Google AIP-134 (πεδίο στη μάσκα χωρίς τιμή = «καθάρισε»)
 *
 * 🔑 **Γιατί υπάρχει**: το `update({ x: null })` του Firestore **δεν** σβήνει — αποθηκεύει `null`. Για πεδία όπου η
 * **απουσία** είναι η κανονική μορφή του «δεν δηλώθηκε», ένα αποθηκευμένο `null` είναι δεύτερη μορφή για το ίδιο νόημα.
 *
 * ⚠️ **Ο καλών αποφασίζει ΠΟΙΑ πεδία σβήνονται** (`isClearable`), επίτηδες: πεδία σύνδεσης (`floorId` κ.λπ.) αποθηκεύουν
 * `null` ως τιμή *«αποσυνδέθηκε»*, και η διαγραφή θα τα έβγαζε από ερωτήματα `where(…, '==', null)` (το Firestore δεν
 * ευρετηριάζει απόν πεδίο). Η προεπιλογή «όλα» ταιριάζει μόνο σε patch που περιέχει αποκλειστικά τέτοια πεδία.
 *
 * ⚠️ **Καλείται ΜΟΝΟ τη στιγμή της εγγραφής** — ιστορικό, κλείδωμα και προβολή βλέπουν το καθαρό `null`, ποτέ το σύμβολο.
 */

import { FieldValue } from 'firebase-admin/firestore';

/** Ποια πεδία ενός patch σβήνονται όταν φέρουν `null`. */
export type ClearablePredicate = (field: string) => boolean;

const EVERY_FIELD: ClearablePredicate = () => true;

/** Σβήνεται αυτή η καταχώριση; — `null` σε πεδίο που ο καλών δηλώνει σβήσιμο. */
function isMergePatchDelete(field: string, value: unknown, isClearable: ClearablePredicate = EVERY_FIELD): boolean {
  return value === null && isClearable(field);
}

/** **Το patch όπως το γράφει το Firestore** — νέο αντικείμενο· η είσοδος δεν αλλάζει. */
export function withMergePatchDeletes(
  patch: Readonly<Record<string, unknown>>,
  isClearable: ClearablePredicate = EVERY_FIELD,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).map(([field, value]) => [
      field,
      isMergePatchDelete(field, value, isClearable) ? FieldValue.delete() : value,
    ]),
  );
}

/** **Το έγγραφο όπως θα είναι μετά την εγγραφή** — τα σβησμένα πεδία λείπουν, όπως και στο Firestore. */
export function documentAfterMergePatch(
  existing: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
  isClearable: ClearablePredicate = EVERY_FIELD,
): Record<string, unknown> {
  const after: Record<string, unknown> = { ...existing, ...patch };
  for (const [field, value] of Object.entries(patch)) {
    if (isMergePatchDelete(field, value, isClearable)) delete after[field];
  }
  return after;
}
