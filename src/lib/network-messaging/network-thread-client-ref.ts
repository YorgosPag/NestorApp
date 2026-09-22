/**
 * @fileoverview **ΤΑ ΜΟΝΟΠΑΤΙΑ ΤΟΥ ΝΗΜΑΤΟΣ ΓΙΑ ΤΟΝ ΠΕΛΑΤΗ** (Web SDK) — χτισμένα σε **ένα** σημείο, **μόνο ανάγνωση**.
 * @related ADR-867 Β7 · CHECK 3.89 Κ1 (+ Κ7) · `services/network-messaging/network-thread-ref.ts` (ο δίδυμος του Admin SDK)
 * @module lib/network-messaging/network-thread-client-ref
 *
 * 🔑 **ΕΝΑΣ ΤΟΠΟΣ ΑΝΑ SDK**: το `network-thread-ref.ts` είναι `server-only` (Admin SDK)· η ζωντανή οθόνη (Β7)
 * διαβάζει με το Web SDK, με **άλλους τύπους**. Αν το hook έχτιζε μόνο του το μονοπάτι, τα ονόματα των
 * υποσυλλογών (`network_messages`, `network_audience` — **μηχανισμός**, όχι στυλ: ADR-867 §4.1) θα ζούσαν σε
 * τρίτο σημείο — ακριβώς ό,τι αρνείται ο Κ1 της CHECK 3.89 (και το έπιασε, 2026-09-19).
 *
 * ⛔ **ΚΑΜΙΑ ΓΡΑΦΗ, ΠΟΤΕ** (Κ7 της CHECK 3.89): οι κανόνες κλείνουν κάθε γραφή πελάτη (`if false`) και κάθε
 * πράξη περνά από διαδρομή (`network-thread.client.ts`). Ένα `setDoc` εδώ θα ήταν δεύτερος γραφέας που απλώς
 * «δεν έχει γίνει ακόμη» πρόβλημα.
 */

import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  type CollectionReference,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';

/** `network_threads/{threadId}` — ανάγνωση μόνο αν διαβάζω (κανόνας: ζωντανή γραμμή ακροατηρίου). */
export function clientThreadDoc(threadId: string): DocumentReference {
  return doc(db, COLLECTIONS.NETWORK_THREADS, threadId);
}

/** `…/network_audience` — **όλο** το ακροατήριο (και οι σφραγισμένοι: «ποιοι διάβαζαν»). */
export function clientThreadAudience(threadId: string): CollectionReference {
  return collection(db, COLLECTIONS.NETWORK_THREADS, threadId, SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE);
}

/** `…/network_audience_private/{uid}` — η **δική μου** ιδιωτική πλευρά (κανόνας: μόνο ο ίδιος · ADR-867 Ε9). */
export function clientAudiencePrivateDoc(threadId: string, uid: string): DocumentReference {
  return doc(db, COLLECTIONS.NETWORK_THREADS, threadId, SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE_PRIVATE, uid);
}

/** `…/network_messages` — τα **τελευταία** `windowSize` μηνύματα (νεότερο πρώτο· η οθόνη αντιστρέφει). */
export function clientRecentMessages(threadId: string, windowSize: number): Query {
  return query(
    collection(db, COLLECTIONS.NETWORK_THREADS, threadId, SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES),
    orderBy('createdAt', 'desc'),
    limit(windowSize),
  );
}

/**
 * 🔢 **Οι γραμμές αδιάβαστων του ίδιου του αναγνώστη** (ADR-867 §4.5 · Β10) — `network_inbox/{uid}/network_inbox_unread`,
 * με **οροφή**. Το badge είναι το πλήθος τους· `max` = πόσες χρειάζεται για να ξέρει ότι ξεπέρασε την οροφή του
 * σήματος (99 ⇒ 100). ⚠️ **Χωρίς** `orderBy`/`where`: ένα ερώτημα χωρίς φίλτρο δεν χρειάζεται σύνθετο δείκτη.
 */
export function clientInboxUnreadRows(uid: string, max: number): Query {
  // tenant-scope-exempt: ο άξονας είναι η ΔΙΑΔΡΟΜΗ, όχι πεδίο — `network_inbox/{uid}` ανήκει στο πρόσωπο (κανένα
  // `companyId`) και ο κανόνας `isOwner(uid)` αρνείται λίστα σε κάθε άλλον (ADR-867 §4.5 · firestore.rules).
  return query(collection(db, COLLECTIONS.NETWORK_INBOX, uid, SUBCOLLECTIONS.NETWORK_INBOX_UNREAD), limit(max));
}
