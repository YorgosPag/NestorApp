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

/**
 * Η **μοναδική** τιμή κατάστασης που σημαίνει «στο αρχείο» (ADR-281 · ADR-329 §3.9).
 *
 * Κάδος και αρχείο είναι **δύο έννοιες στο ΙΔΙΟ πεδίο**: ο κάδος σβήνεται οριστικά μετά την
 * προθεσμία, το αρχείο μένει για πάντα επειδή το αναφέρουν άλλες εγγραφές. Ένα πεδίο ⇒ μια
 * εγγραφή δεν μπορεί να είναι και στα δύο.
 *
 * ⚠️ Ποιες οντότητες **έχουν** αρχείο το λέει το `SOFT_DELETE_CONFIG[…].archive`, όχι αυτή η
 * σταθερά. Το `RecordLifecycleStatus` των θέσεων/αποθηκών μένει σκόπιμα δίτιμο (ADR-777 §8.60.20).
 */
export const ARCHIVED_STATUS = 'archived';

/** «Είναι στο αρχείο;» — ρώτα αυτό, μην συγκρίνεις συμβολοσειρά. */
export const isArchived = (entity: MaybeTrashed | null | undefined): boolean =>
  entity?.status === ARCHIVED_STATUS;

/**
 * «Έχει αποσυρθεί από την καθημερινή δουλειά;» — κάδος **ή** αρχείο.
 *
 * Αυτό ρωτά κάθε λίστα και κάθε επιλογέας. Όποιος ρωτά μόνο `isTrashed` για να αποφασίσει
 * «το δείχνω;» θα δείξει τα αρχειοθετημένα.
 */
export const isRetired = (entity: MaybeTrashed | null | undefined): boolean =>
  isTrashed(entity) || isArchived(entity);

/**
 * Πόσο μένει μια εγγραφή στον κάδο πριν την αφαιρέσει η εκκαθάριση — 30 ημέρες.
 *
 * Η **ίδια** υπόσχεση προς τον άνθρωπο («έχεις έναν μήνα να αλλάξεις γνώμη») που εκτελούν τα
 * purge jobs (μέσω `cron-auth`, που την ξαναεξάγει) και που **λέει** η ταινία του κλειδωμένου
 * πλαισίου. Μία δήλωση ⇒ το κείμενο και η εκκαθάριση δεν αποκλίνουν.
 */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Οι τιμές `status` που σημαίνουν «αποσυρμένο» — για ερωτήματα `not-in` στον διακομιστή. */
export const RETIRED_STATUSES: readonly string[] = [TRASHED_STATUS, ARCHIVED_STATUS];

/** Ποια απόσυρση — `null` για ζωντανή εγγραφή. */
export type RetiredKind = 'archived' | 'trashed';

/**
 * «Σε ποια απόσυρση είναι;» — η ΜΙΑ απάντηση που ρωτά κάθε οθόνη πριν προσφέρει γραφή ή προσφορά.
 *
 * Γεννήθηκε στο `linked-retired-properties` (επιλογείς ακινήτων) και ανέβηκε εδώ όταν απέκτησε
 * δεύτερο καταναλωτή (κάρτα · πλαίσιο λεπτομερειών, ADR-329 §3.9): δεν ρωτά τίποτα ειδικό για ακίνητο.
 */
export function retiredKindOf(entity: MaybeTrashed | null | undefined): RetiredKind | null {
  if (isArchived(entity)) return 'archived';
  if (isTrashed(entity)) return 'trashed';
  return null;
}
