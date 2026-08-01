/**
 * «Το μήνυμα — αν είναι δικό μου»: ο φορτωτής του πόρου `message`
 *
 * Λεπτό δέσιμο πάνω στη **γενική** αλυσίδα ({@link loadOwnedDoc}). Εδώ ζει
 * **μόνο** ό,τι κάνει τα μηνύματα διαφορετικά: η συλλογή, το εργοστάσιο «δεν
 * βρέθηκε» και ο φύλακας.
 *
 * ⚠️ **Μην ξαναγράψεις εδώ τη σειρά φόρτωσε→υπάρχει;→δικό μου;** — ζει στο
 * `lib/auth/owned-doc-loader.ts` ώστε να μην έχει ο κάθε πόρος δικό του
 * αντίγραφο (N.18· μάθημα #7 των Ομάδων 1–3).
 *
 * 🔴 **Δεν το χρησιμοποιεί το μαζικό `delete`** — και δεν είναι παράλειψη: εκεί
 * η άρνηση είναι **στοιχείο πίνακα** μέσα σε απάντηση `200`, οπότε η διαδρομή
 * καλεί την ετυμηγορία (`checkMessageAccess`) και **δεν** ρίχνει. Η αλυσίδα
 * αυτή ρίχνει εξ ορισμού· χρησιμοποιώντας την, το πρώτο ξένο id θα ακύρωνε τη
 * διαγραφή **όλης** της παρτίδας (ADR-742 §7ter.5).
 *
 * @module app/api/messages/_shared/message-owned-doc
 * @see @/lib/auth/owned-doc-loader — η αλυσίδα
 * @see ./message-ownership — η ερώτηση + το εργοστάσιο «δεν βρέθηκε»
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { loadOwnedDoc, type OwnedDoc } from '@/lib/auth/owned-doc-loader';
import {
  messageNotFound,
  requireMessageAccess,
  type MessageAccessCaller,
} from './message-ownership';

export interface LoadOwnedMessageSpec {
  readonly messageId: string;
  readonly caller: MessageAccessCaller;
  /** Ποιο μονοπάτι ρώτησε — μπαίνει στα logs ασφαλείας του φύλακα. */
  readonly action: string;
  readonly db?: Firestore;
}

/**
 * Διαβάζει το μήνυμα και **αμέσως** το κρίνει.
 *
 * Και τα δύο «όχι» βγαίνουν από το **ίδιο** {@link messageNotFound}: ο γνήσιος
 * κλάδος μέσω `notFound`, η άρνηση ιδιοκτησίας μέσω του
 * {@link requireMessageAccess}. Δεν υπάρχει όρισμα που να τα διαφοροποιεί.
 */
export function loadOwnedMessage(spec: LoadOwnedMessageSpec): Promise<OwnedDoc> {
  const { messageId, caller, action } = spec;

  return loadOwnedDoc({
    collection: COLLECTIONS.MESSAGES,
    docId: messageId,
    action,
    resourceLabel: 'Message',
    notFound: messageNotFound,
    assertOwned: (messageData) =>
      requireMessageAccess({ messageData, caller, messageId, action }),
    ...(spec.db === undefined ? {} : { db: spec.db }),
  });
}
