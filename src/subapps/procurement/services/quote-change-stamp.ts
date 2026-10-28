import 'server-only';

import admin from 'firebase-admin';
import { adminTimestampAsClient } from '@/services/vendor-portal/admin-client-timestamp';
import type { Quote } from '../types/quote';

/**
 * **Η ΜΙΑ σφραγίδα «ποιος/πότε άλλαξε» μιας προσφοράς** στον server (ADR-328 §5.J.5).
 *
 * Κάθε εγγραφή Admin SDK σε `quotes/{id}` απλώνει αυτό το αντικείμενο — έτσι το `updatedBy` λέει **πάντα** ποιος
 * έγραψε τελευταίος (όχι ποιος δημιούργησε), και οι ζωντανές ειδοποιήσεις ξέρουν αν η αλλαγή είναι **δική σου**.
 * Ο client (`quote-versioning-service.nextVersionFields`) γράφει τα ίδια δύο πεδία με το δικό του SDK.
 *
 * @param actor uid εσωτερικού χρήστη (`ctx.uid`) ή `vendorActorId(…)` για την πύλη προμηθευτή.
 * @param at    ίδιος χρόνος με άλλα πεδία της ίδιας εγγραφής (π.χ. `createdAt`), αλλιώς «τώρα».
 */
export function quoteChangeStamp(
  actor: string,
  at: admin.firestore.Timestamp = admin.firestore.Timestamp.now(),
): Required<Pick<Quote, 'updatedAt' | 'updatedBy'>> {
  return { updatedAt: adminTimestampAsClient(at), updatedBy: actor };
}
