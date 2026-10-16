/**
 * =============================================================================
 * «Τι έγγραφο είναι αυτό το αρχείο;» — από τον κατάλογο μεταβίβασης, χωρίς υπόθεση (ADR-915 §20)
 * =============================================================================
 *
 * Ένα αρχείο κουβαλά `(entityType, purpose)` — ποτέ «είδος εγγράφου». Ποιο είδος **υπόσχεται** το ξέρει ήδη ο ΕΝΑΣ
 * κατάλογος: κάθε γραμμή με `documentKind` δηλώνει ποια entry points την ικανοποιούν. Εδώ η ίδια αντιστοίχιση
 * διαβάζεται ανάποδα (`matchersAcceptFile`) — καμία δεύτερη λίστα «purpose → είδος» που θα απέκλινε σιωπηλά.
 *
 * Επιστρέφει **σύνολο**: ένας σκοπός μπορεί θεωρητικά να υπηρετεί δύο είδη· ποιο από τα δύο είναι, το λέει μόνο το
 * ίδιο το έγγραφο (ο αναγνώστης κειμένου).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, ασφαλές σε server/client/tests.
 *
 * @module lib/conveyance/document-kind-of-file
 */

import { CONVEYANCE_CHECKLIST } from '@/config/conveyance-checklist/catalog';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { matchersAcceptFile } from './evidence-match';

/** Ό,τι χρειάζεται η ερώτηση από την εγγραφή αρχείου — δομικό. */
export interface DocumentKindFileRef {
  readonly entityType?: unknown;
  readonly purpose?: unknown;
}

/** Τα είδη εγγράφου που υπόσχεται ο κατάλογος για αυτό το αρχείο — κενό = το αρχείο δεν παρακολουθείται. */
export function documentKindsOfFile(file: DocumentKindFileRef): readonly DocumentKind[] {
  const { entityType, purpose } = file;
  if (typeof entityType !== 'string' || typeof purpose !== 'string') return [];
  const kinds = new Set<DocumentKind>();
  for (const item of CONVEYANCE_CHECKLIST) {
    if (item.documentKind === undefined || item.satisfaction.kind !== 'files') continue;
    if (matchersAcceptFile(item.satisfaction.matchers, entityType, purpose)) kinds.add(item.documentKind);
  }
  return [...kinds];
}
