/**
 * Ποιες από τις επαφές που βρήκε ένα ερώτημα είναι **κάτοχοι** ενός αναγνωριστικού (ΑΦΜ · email).
 *
 * Μία απάντηση για τις δύο αναζητήσεις (`findVatHolders` · `findContactsWithEmail`), ώστε ο κανόνας
 * «ποιος μετρά ως κάτοχος» να μη γράφεται δύο φορές (ADR-944 §9.7):
 *  - η επαφή που επεξεργάζεται δεν είναι κάτοχος του εαυτού της·
 *  - επαφή **στον κάδο** δεν είναι κάτοχος — αλλιώς κρατά το ΑΦΜ / email της δεσμευμένο για πάντα.
 *
 * ⚠️ Το φίλτρο τρέχει στον πελάτη, **μετά** το `limit` του ερωτήματος: αν ο κάδος γεμίσει το όριο,
 * ζωντανός κάτοχος μπορεί να μη φανεί. Δηλωμένο όριο· δεν απαιτεί νέο δείκτη.
 *
 * @module lib/contacts/live-identifier-holders
 */

import type { QueryDocumentSnapshot } from 'firebase/firestore';

import type { IdentifierHolder } from '@/lib/contacts/contact-identifier-duplicate-policy';
import { isTrashed } from '@/lib/firestore/trashed-status';
import type { Contact } from '@/types/contacts';

export function liveIdentifierHolders(
  docs: readonly QueryDocumentSnapshot<Contact>[],
  excludeContactId: string | undefined,
  nameOf: (contact: Contact) => string,
): readonly IdentifierHolder[] {
  return docs
    .filter((doc) => doc.id !== excludeContactId)
    .map((doc) => ({ id: doc.id, contact: doc.data() }))
    .filter(({ contact }) => !isTrashed(contact))
    .map(({ id, contact }) => ({ id, name: nameOf(contact), type: contact.type }));
}
