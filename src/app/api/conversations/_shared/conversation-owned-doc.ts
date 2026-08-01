/**
 * «Η συνομιλία — αν είναι δική μου»: ο φορτωτής του πόρου `conversation`
 *
 * Λεπτό δέσιμο πάνω στη **γενική** αλυσίδα ({@link loadOwnedDoc}). Εδώ ζει
 * **μόνο** ό,τι κάνει τις συνομιλίες διαφορετικές: η συλλογή, το εργοστάσιο
 * «δεν βρέθηκε» (που κρατά το id **μέσα** στο μήνυμα) και ο φύλακας.
 *
 * ⚠️ **Μην ξαναγράψεις εδώ τη σειρά φόρτωσε→υπάρχει;→δικό μου;** — ζει στο
 * `lib/auth/owned-doc-loader.ts` (N.18· μάθημα #7).
 *
 * @module app/api/conversations/_shared/conversation-owned-doc
 * @see @/lib/auth/owned-doc-loader — η αλυσίδα
 * @see ./conversation-ownership — η ερώτηση + το εργοστάσιο «δεν βρέθηκε»
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { loadOwnedDoc, type OwnedDoc } from '@/lib/auth/owned-doc-loader';
import {
  conversationNotFound,
  requireConversationAccess,
  type ConversationAccessCaller,
} from './conversation-ownership';

export interface LoadOwnedConversationSpec {
  readonly conversationId: string;
  readonly caller: ConversationAccessCaller;
  /** Ποιο μονοπάτι ρώτησε — μπαίνει στα logs ασφαλείας του φύλακα. */
  readonly action: string;
  readonly db?: Firestore;
}

/**
 * Διαβάζει τη συνομιλία και **αμέσως** την κρίνει.
 *
 * Και τα δύο «όχι» βγαίνουν από το **ίδιο** {@link conversationNotFound}, με
 * το **ίδιο** id — δεν υπάρχει πεδίο του σύρματος που να τα ξεχωρίζει.
 */
export function loadOwnedConversation(
  spec: LoadOwnedConversationSpec,
): Promise<OwnedDoc> {
  const { conversationId, caller, action } = spec;

  return loadOwnedDoc({
    collection: COLLECTIONS.CONVERSATIONS,
    docId: conversationId,
    action,
    resourceLabel: 'Conversation',
    notFound: () => conversationNotFound(conversationId),
    assertOwned: (conversationData) =>
      requireConversationAccess({ conversationData, caller, conversationId, action }),
    ...(spec.db === undefined ? {} : { db: spec.db }),
  });
}
