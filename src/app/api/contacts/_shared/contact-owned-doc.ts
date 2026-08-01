/**
 * «Η επαφή — αν είναι δική μου»: ο φορτωτής του πόρου `contact`
 *
 * Λεπτό δέσιμο πάνω στη **γενική** αλυσίδα ({@link loadOwnedDoc}). Εδώ ζει
 * **μόνο** ό,τι κάνει τις επαφές διαφορετικές από κάθε άλλο πόρο: η συλλογή,
 * το εργοστάσιο «δεν βρέθηκε» και ο φύλακας.
 *
 * ⚠️ **Μην ξαναγράψεις εδώ τη σειρά φόρτωσε→υπάρχει;→δικό μου;** — ζει στο
 * `lib/auth/owned-doc-loader.ts` ακριβώς για να μην έχει ο κάθε πόρος δικό του
 * αντίγραφο (N.18· μάθημα #7 των Ομάδων 1–3).
 *
 * @module app/api/contacts/_shared/contact-owned-doc
 * @see @/lib/auth/owned-doc-loader — η αλυσίδα
 * @see ./contact-ownership — η ερώτηση + τα εργοστάσια «δεν βρέθηκε»
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { loadOwnedDoc, type OwnedDoc } from '@/lib/auth/owned-doc-loader';
import {
  contactNotFound,
  requireContactAccess,
  type ContactAccessCaller,
} from './contact-ownership';

export interface LoadOwnedContactSpec {
  readonly contactId: string;
  readonly caller: ContactAccessCaller;
  /** Ποιο μονοπάτι ρώτησε — μπαίνει στα logs ασφαλείας του φύλακα. */
  readonly action: string;
  readonly db?: Firestore;
}

/**
 * Διαβάζει την επαφή και **αμέσως** την κρίνει.
 *
 * Και τα δύο «όχι» βγαίνουν από το **ίδιο** {@link contactNotFound}: ο γνήσιος
 * κλάδος το καλεί μέσω `notFound`, η άρνηση ιδιοκτησίας μέσω του
 * {@link requireContactAccess}. Δεν υπάρχει όρισμα που να τα διαφοροποιεί.
 */
export function loadOwnedContact(spec: LoadOwnedContactSpec): Promise<OwnedDoc> {
  const { contactId, caller, action } = spec;

  return loadOwnedDoc({
    collection: COLLECTIONS.CONTACTS,
    docId: contactId,
    action,
    resourceLabel: 'Contact',
    notFound: contactNotFound,
    assertOwned: (contactData) =>
      requireContactAccess({ contactData, caller, contactId, action }),
    ...(spec.db === undefined ? {} : { db: spec.db }),
  });
}
