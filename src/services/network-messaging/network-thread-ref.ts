/**
 * @fileoverview **ΤΟ ΜΟΝΟΠΑΤΙ ΤΟΥ ΝΗΜΑΤΟΣ — ΧΤΙΖΕΤΑΙ ΕΔΩ ΚΑΙ ΜΟΝΟ ΕΔΩ** (ADR-867 §4.1/§4.2).
 * @related CHECK 3.89 (πύλη της αρχής του νήματος) · αδελφό ιδίωμα: `lib/auth/project-member-ref.ts`
 * @module services/network-messaging/network-thread-ref
 *
 * 🔑 **Γιατί ξεχωριστό αρχείο και όχι δύο γραμμές μέσα στον γραφέα**: το μονοπάτι είναι
 * **δημόσια** γνώση (το χρειάζονται ο γραφέας, ο αναγνώστης, οι διαδρομές API), ενώ η
 * **γραφή** δεν είναι. Με τα δύο μαζί, κάθε αναγνώστης θα εισήγαγε τον γραφέα — και η
 * πύλη «ένας γραφέας» θα μετρούσε εισαγωγές αντί για γραφές.
 *
 * ⛔ **ΚΑΝΕΝΑ `COLLECTIONS.NETWORK_THREADS` / `SUBCOLLECTIONS.NETWORK_THREAD_*` ΑΛΛΟΥ.**
 * Το επιβάλλει το **Κ1** του CHECK 3.89. Ο λόγος είναι μετρημένος αλλού στο ίδιο δέντρο:
 * το `WORKSPACE_MEMBERS` λεγόταν `'members'` — ταυτόσημο με το `PROJECT_MEMBERS` — και ένα
 * collection group query επέστρεφε μέλη **ΕΡΓΟΥ** ως μέλη **ΓΡΑΦΕΙΟΥ**, σιωπηλά. Όταν το
 * όνομα ζει σε ένα σημείο, η μετονομασία είναι **μία** γραμμή· όταν ζει σε δέκα, είναι τύχη.
 */

import 'server-only';

import type {
  CollectionReference,
  DocumentReference,
  Firestore as AdminFirestore,
  Query,
} from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';

/** `network_threads/{nthr_*}` */
export function networkThreadRef(
  adminDb: AdminFirestore,
  threadId: string,
): DocumentReference {
  return adminDb.collection(COLLECTIONS.NETWORK_THREADS).doc(threadId);
}

/**
 * `network_threads/{id}/network_audience` — **η απάντηση στο «ποιος διαβάζει;»**.
 *
 * ⚠️ Το όνομα **δεν** είναι `audience`: δες `firestore-collections.ts`. Ένα γενικό όνομα
 * υποσυλλογής γίνεται καθολικό όνομα σε κάθε collection group query.
 */
export function networkThreadAudience(
  adminDb: AdminFirestore,
  threadId: string,
): CollectionReference {
  return networkThreadRef(adminDb, threadId).collection(
    SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE,
  );
}

/** `network_threads/{id}/network_audience/{uid}` — **το κλειδί ΕΙΝΑΙ το πρόσωπο.** */
export function networkAudienceRef(
  adminDb: AdminFirestore,
  threadId: string,
  uid: string,
): DocumentReference {
  return networkThreadAudience(adminDb, threadId).doc(uid);
}

/**
 * **ΟΛΕΣ οι γραμμές ακροατηρίου, σε ΟΛΑ τα νήματα** — collection group, για τον κατάλογο.
 *
 * 🔴 **Εδώ φαίνεται γιατί το όνομα είναι `network_audience` και όχι `audience`**: ένα collection
 * group σαρώνει **κατά όνομα** υποσυλλογής σε **όλη** τη βάση. Με γενικό όνομα, ο κατάλογος
 * νημάτων θα επέστρεφε γραμμές **άσχετων** συλλογών με το ίδιο όνομα.
 * ⚠️ Μόνο **ανάγνωση** — ένα ερώτημα δεν γράφει· ο δείκτης του ζει στο `firestore.indexes.json`.
 */
export function networkAudienceGroup(adminDb: AdminFirestore): Query {
  return adminDb.collectionGroup(SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE);
}

/** `network_threads/{id}/network_messages` */
export function networkThreadMessages(
  adminDb: AdminFirestore,
  threadId: string,
): CollectionReference {
  return networkThreadRef(adminDb, threadId).collection(
    SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES,
  );
}

/**
 * `network_message_retractions/{nmsg_*}` — **το αντίγραφο συμμόρφωσης**.
 *
 * 🔑 **ΤΟΠ-ΛΕΒΕΛ, ΟΧΙ ΥΠΟΣΥΛΛΟΓΗ ΤΟΥ ΝΗΜΑΤΟΣ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΑΣΦΑΛΕΙΑΣ.** Μια
 * υποσυλλογή θα ζούσε **μέσα** στο `match /network_threads/{threadId}`, δηλαδή δίπλα σε
 * δύο υποσυλλογές που **δίνουν ανάγνωση** στο ακροατήριο. Ένα μελλοντικό
 * `match /{document=**}` ή ένα αντιγραμμένο μπλοκ θα την άνοιγε **σιωπηλά** — και το
 * κείμενο που ο άνθρωπος νόμιζε ότι πήρε πίσω θα ήταν ένα ερώτημα μακριά.
 *
 * ⇒ Χωριστή ρίζα, χωριστός κανόνας, `read/write: if false` για **κάθε** πελάτη.
 * ⚠️ Το κλειδί είναι **το id του μηνύματος** — καμία νέα ταυτότητα (XEP-0424: η
 * ανάκληση **αναφέρεται** στο μήνυμα, δεν είναι δικό της αντικείμενο).
 */
export function networkRetractionRef(
  adminDb: AdminFirestore,
  messageId: string,
): DocumentReference {
  return adminDb.collection(COLLECTIONS.NETWORK_MESSAGE_RETRACTIONS).doc(messageId);
}

/**
 * `network_message_revisions/{nmrv_*}` — **το κείμενο πριν από μια επεξεργασία** (ADR-867 Β7).
 * Top-level και κλειστό για τον **ίδιο** λόγο με το αντίγραφο ανάκλησης (δες από πάνω).
 */
export function networkRevisionRef(
  adminDb: AdminFirestore,
  revisionId: string,
): DocumentReference {
  return adminDb.collection(COLLECTIONS.NETWORK_MESSAGE_REVISIONS).doc(revisionId);
}
