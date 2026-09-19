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

/**
 * Η τιμή «ζωντανή εγγραφή» — η απάντηση «όχι» στο «είναι στον κάδο;». Ήταν ωμό `'active'`
 * στο `soft-delete-config` (επαφή · κτίριο). Για θέσεις και αποθήκες είναι πλέον η **μόνη**
 * άλλη τιμή του `status` (ADR-777 §8.60.20): η εμπορική αλήθεια ζει στο `commercialStatus`,
 * η φυσική στο `operationalStatus`.
 */
export const ACTIVE_RECORD_STATUS = 'active';

/** Ο κύκλος ζωής μιας εγγραφής: ζωντανή ή στον κάδο — τίποτε άλλο. */
export type RecordLifecycleStatus = typeof ACTIVE_RECORD_STATUS | typeof TRASHED_STATUS;

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
