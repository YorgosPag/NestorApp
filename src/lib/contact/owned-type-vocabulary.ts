/**
 * 🧩 Οι **δύο ερωτήσεις** που κάνει κάθε λεξιλόγιο τύπου επικοινωνίας ανά κάτοχο (τηλέφωνο · email · ιστοσελίδα · social):
 * «ανήκει η τιμή στη ρίζα;» και «την προσφέρει αυτός ο κάτοχος;».
 *
 * Ζουν εδώ ΜΙΑ φορά (ADR-327 §8.5.4) ώστε τα τέσσερα λεξιλόγια να δηλώνουν μόνο **δεδομένα** (ρίζα, υποσύνολα,
 * προεπιλογές) — τέσσερα αντίγραφα της ίδιας `includes` θα ήταν τέσσερα δίδυμα (N.18).
 *
 * @module lib/contact/owned-type-vocabulary
 */

import type { ContactOwnerKind } from './contact-owner-kind';

/** `true` όταν η τιμή ανήκει στη ρίζα — το σύνορο εισόδου από φόρμα/εξωτερικά δεδομένα, αντί για τυφλό `as`. */
export function isVocabularyMember<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** `true` όταν ο τύπος ανήκει στο υποσύνολο του κατόχου — αλλιώς η φόρμα του θα τον έδειχνε κενό. */
export function isOfferedBy<T extends string>(
  byOwner: Readonly<Record<ContactOwnerKind, readonly T[]>>,
  owner: ContactOwnerKind,
  value: unknown,
): value is T {
  return isVocabularyMember(byOwner[owner], value);
}
