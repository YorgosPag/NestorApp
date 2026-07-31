/**
 * Δύο συστατικά που κάθε υπηρεσία με audit trail ξαναέγραφε — μία γραφή
 *
 * Βρέθηκαν ως **δομικά δίδυμα** (CHECK 3.28) μεταξύ των
 * `text-engine/templates/text-template.service.ts` και
 * `text-engine/spell/custom-dictionary.service.ts`: ταυτόσημο `fieldChange()`
 * και ταυτόσημη «σφραγίδα δημιουργίας» στα έξι πεδία ιχνηλασίας.
 *
 * ⚠️ Δεν είναι καλλωπισμός: η σφραγίδα ορίζει **ποιος** και **πότε** για κάθε
 * έγγραφο. Δύο αντίγραφα σημαίνουν ότι η προσθήκη ενός έβδομου πεδίου (π.χ.
 * `createdByRole`) θα γινόταν στο ένα και θα ξεχνιόταν στο άλλο — και το κενό
 * θα φαινόταν μόνο σε έλεγχο, μήνες αργότερα.
 *
 * @module services/audit/audit-field-helpers
 * @see ADR-195 (audit trail), ADR-344 (text engine services)
 */

import type { AuditFieldChange } from '@/types/audit-trail';

/** Μία μεταβολή πεδίου για το audit trail. Το `label` είναι προαιρετικό. */
export function fieldChange(
  field: string,
  oldValue: AuditFieldChange['oldValue'],
  newValue: AuditFieldChange['newValue'],
  label?: string,
): AuditFieldChange {
  return label ? { field, oldValue, newValue, label } : { field, oldValue, newValue };
}

/** Ο δράστης μιας μεταβολής, όπως τον ξέρουν οι υπηρεσίες. */
export interface AuditActorFields {
  readonly userId: string;
  readonly userName?: string | null;
}

/**
 * Τα έξι πεδία ιχνηλασίας ενός **νεοδημιούργητου** εγγράφου.
 *
 * `updatedBy`/`updatedAt` γεμίζουν κι αυτά κατά τη δημιουργία **σκόπιμα**: ένα
 * έγγραφο που δεν ενημερώθηκε ποτέ έχει «τελευταία ενημέρωση» τη δημιουργία
 * του. Το `null` — ποτέ `undefined` — γιατί η Firestore απορρίπτει το δεύτερο.
 *
 * Το `now` δίνεται από τον καλούντα (συνήθως `FieldValue.serverTimestamp()`),
 * ώστε ο χρόνος να έρχεται από τον διακομιστή και όχι από το ρολόι του πελάτη.
 */
export function creationStampFields<T>(
  actor: AuditActorFields,
  now: T,
): {
  readonly createdAt: T;
  readonly updatedAt: T;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
} {
  return {
    createdAt: now,
    updatedAt: now,
    createdBy: actor.userId,
    createdByName: actor.userName ?? null,
    updatedBy: actor.userId,
    updatedByName: actor.userName ?? null,
  };
}
