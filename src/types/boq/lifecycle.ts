/**
 * BOQ Governance Lifecycle — Ordering SSoT
 *
 * Μοναδική πηγή αλήθειας για το **πόσο ώριμη** είναι μια κατάσταση BOQ item
 * σε σχέση με μια άλλη. Το `units.ts` ορίζει *ποιες* καταστάσεις υπάρχουν και
 * *ποιες* είναι auto-managed / frozen· εδώ ορίζεται η **διάταξή** τους.
 *
 * Γιατί χωριστό αρχείο και όχι μέσα στο `units.ts`:
 * το `units.ts` απαντά «τι επιτρέπεται να αγγίξει ο BIM auto-sync;»
 * (`BOQ_AUTO_MANAGED_STATUSES` / `BOQ_FROZEN_BASELINE_STATUSES` — διαμέριση κατά
 * *μεταβλητότητα*). Εδώ απαντάται «ποια κατάσταση είναι χαμηλότερη;» — ολική
 * διάταξη κατά *ωριμότητα*. Οι δύο συμπίπτουν σήμερα αλλά δεν είναι η ίδια
 * ερώτηση· βλ. το drift test που τις δένει (`__tests__/boq-lifecycle.test.ts`).
 *
 * Πρώτος καταναλωτής: ADR-734 §6.3 κανόνας 1 — το `effectiveStatus` ενός συνόλου
 * είναι η ΧΑΜΗΛΟΤΕΡΗ κατάσταση του συνόλου. 99 certified + 1 draft ΔΕΝ είναι
 * certified.
 *
 * @module types/boq/lifecycle
 * @see ADR-734 §6.3 (Verifiable Quantity Envelope — μη διαπραγματεύσιμοι κανόνες)
 * @see ADR-175 §4.2, ADR-673, ADR-674, ADR-675
 */

import type { BOQItemStatus } from './units';

// ============================================================================
// RANK — ολική διάταξη ωριμότητας
// ============================================================================

/**
 * Βαθμίδα ωριμότητας ανά κατάσταση. Μεγαλύτερο = πιο δεσμευτικό.
 *
 * ⚠️ Ο τύπος `Record<BOQItemStatus, number>` είναι **σκόπιμος**: αν προστεθεί
 * νέα κατάσταση στο `BOQItemStatus`, ο compiler σπάει **εδώ** και υποχρεώνει
 * ρητή απόφαση για τη θέση της στον κύκλο ζωής. Καμία σιωπηλή παράλειψη.
 */
export const BOQ_STATUS_RANK: Readonly<Record<BOQItemStatus, number>> = {
  draft: 0,
  submitted: 1,
  approved: 2,
  certified: 3,
  locked: 4,
};

/**
 * Οι καταστάσεις σε αύξουσα ωριμότητα. Παράγεται από το `BOQ_STATUS_RANK` —
 * ΔΕΝ ξαναγράφεται χειροκίνητα (μία λίστα, μία αλήθεια).
 */
export const BOQ_STATUS_LIFECYCLE_ORDER: readonly BOQItemStatus[] = (
  Object.keys(BOQ_STATUS_RANK) as BOQItemStatus[]
).sort((a, b) => BOQ_STATUS_RANK[a] - BOQ_STATUS_RANK[b]);

/** Η χαμηλότερη δυνατή κατάσταση — η ασφαλής τιμή όταν κάτι δεν αναγνωρίζεται. */
export const LOWEST_BOQ_ITEM_STATUS: BOQItemStatus = BOQ_STATUS_LIFECYCLE_ORDER[0];

/** Η χαμηλότερη κατάσταση που επιτρέπει υπογραφή (ADR-734 §6.2 `isSignable`). */
const MIN_SIGNABLE_BOQ_ITEM_STATUS: BOQItemStatus = 'certified';

// ============================================================================
// ΠΡΟΣΒΑΣΗ
// ============================================================================

/** Type guard: η τιμή είναι αναγνωρισμένη κατάσταση κύκλου ζωής. */
export function isKnownBoqItemStatus(value: unknown): value is BOQItemStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BOQ_STATUS_RANK, value);
}

/**
 * Βαθμίδα ωριμότητας μιας τιμής.
 *
 * ⚠️ **Fail-closed**: άγνωστη/κατεστραμμένη τιμή επιστρέφει `-1`, δηλαδή
 * **κάτω** από το `draft`. Ένα item με άγνωστο status ΔΕΝ ανεβάζει ποτέ την
 * εμπιστοσύνη ενός συνόλου — ο καλών οφείλει να το επισημάνει, όχι να το
 * αγνοήσει.
 */
export function boqStatusRank(value: unknown): number {
  return isKnownBoqItemStatus(value) ? BOQ_STATUS_RANK[value] : -1;
}

/** True όταν η κατάσταση αρκεί για υπογραφή (certified ή locked). */
export function isSignableBoqItemStatus(value: unknown): value is BOQItemStatus {
  return boqStatusRank(value) >= BOQ_STATUS_RANK[MIN_SIGNABLE_BOQ_ITEM_STATUS];
}
