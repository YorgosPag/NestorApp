/**
 * =============================================================================
 * SSoT: **ΠΟΤΕ ΜΙΑ ΕΓΓΡΑΦΗ ΕΙΝΑΙ ΣΤΟΝ ΚΑΔΟ** — client-safe (ADR-281 · ADR-777 §8.31)
 * =============================================================================
 *
 * Η τιμή ζούσε **μόνο** στο `soft-delete-config.ts`, που κάνει `import
 * "server-only"` ⇒ ο πελάτης **δεν μπορούσε** να τη δει και την ξαναέγραφε ωμά:
 * `contactsPageFilters` · `useContactsTrashState` · `NavigationContext` ·
 * `useFirestoreBuildings` · `useFirestoreStorages` … Ίδια τιμή, **καμία**
 * σύνδεση μεταξύ τους (ADR-749: δύο αλήθειες που μπορούν να αποκλίνουν).
 *
 * Αυτό το αρχείο είναι **leaf και ουδέτερο**: καμία εξάρτηση, τρέχει και στις
 * δύο πλευρές. Το `soft-delete-config.ts` το **ξαναεξάγει** — δεν το αντιγράφει
 * — ώστε κάθε υπάρχων διακομιστής-καταναλωτής να μένει αμετάβλητος.
 *
 * @module lib/firestore/trashed-status
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

/** Η **μοναδική** τιμή κατάστασης που σημαίνει «στον κάδο». */
export const TRASHED_STATUS = 'deleted';

/** Το ελάχιστο σχήμα που χρειάζεται για να απαντηθεί το ερώτημα. */
export interface MaybeTrashed {
  readonly status?: string | null;
}

/**
 * ⚠️ **Ρώτα ΑΥΤΟ, μην συγκρίνεις συμβολοσειρά.** Η σύγκριση `=== 'deleted'`
 * σκορπισμένη στον κώδικα είναι ακριβώς ο λόγος που η τιμή έγινε επτά φορές.
 */
export const isTrashed = (entity: MaybeTrashed | null | undefined): boolean =>
  entity?.status === TRASHED_STATUS;
