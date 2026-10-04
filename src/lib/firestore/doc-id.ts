/**
 * =============================================================================
 * SSoT: **ΜΠΟΡΕΙ ΑΥΤΟ ΤΟ ΑΛΦΑΡΙΘΜΗΤΙΚΟ ΝΑ ΕΙΝΑΙ ΤΑΥΤΟΤΗΤΑ ΕΓΓΡΑΦΟΥ FIRESTORE;**
 * =============================================================================
 *
 * Το Firestore **πετά** (`3 INVALID_ARGUMENT`) αντί να απαντήσει «δεν υπάρχει» όταν
 * του ζητηθεί έγγραφο με ταυτότητα που δεν μπορεί ποτέ να υπάρξει: κενή, `.`/`..`,
 * με `/`, της δεσμευμένης μορφής `__.*__`, ή πάνω από 1.500 bytes.
 *
 * 🔴 **Γιατί χρειάστηκε (περιστατικό 2026-10-04)**: η ψευδο-ταυτότητα `__new__` του
 * «Fill then Create» (`lib/draft-entity-id`) έφτασε στον server ως `projectId`. Οι
 * φύλακες ιδιοκτησίας την έδωσαν ωμή στο `.doc(id).get()` ⇒ ρίψη ⇒ **500** ⇒ ο
 * πελάτης ξαναδοκίμασε τρεις φορές ένα αίτημα που δεν μπορούσε ποτέ να πετύχει.
 * Η σωστή απάντηση σε ταυτότητα που δεν μπορεί να υπάρξει είναι **«δεν βρέθηκε»**
 * — η ίδια με κάθε άλλη απουσία (ADR-742 §7septies), **πριν** από κάθε ανάγνωση.
 *
 * **Layering**: leaf module — καμία εξάρτηση, ασφαλές για server και πελάτη.
 *
 * @module lib/firestore/doc-id
 * @see https://firebase.google.com/docs/firestore/quotas#collections_documents_and_fields
 */

/** Το όριο του Firestore για ταυτότητα εγγράφου, σε bytes UTF-8. */
const MAX_DOC_ID_BYTES = 1500;

/** Η δεσμευμένη μορφή του Firestore (`__name__`, `__new__`, …). */
const RESERVED_DOC_ID = /^__.*__$/;

/** Μπορεί αυτή η τιμή να διευθυνσιοδοτήσει έγγραφο; `false` ⇒ απάντησε «δεν βρέθηκε», μη ρωτήσεις τη βάση. */
export function isAddressableDocId(id: unknown): id is string {
  if (typeof id !== 'string' || id.length === 0) return false;
  if (id === '.' || id === '..') return false;
  if (id.includes('/')) return false;
  if (RESERVED_DOC_ID.test(id)) return false;
  return new TextEncoder().encode(id).length <= MAX_DOC_ID_BYTES;
}
