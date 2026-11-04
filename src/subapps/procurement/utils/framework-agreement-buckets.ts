/**
 * =============================================================================
 * ΟΙ ΚΟΥΒΑΔΕΣ ΤΩΝ ΣΥΜΒΑΣΕΩΝ-ΠΛΑΙΣΙΟ — ο ΕΝΑΣ ορισμός του «ενεργή» (ADR-330 §5.1 S3.4)
 * =============================================================================
 *
 * 🔴 **Το εύρημα**: η κάρτα του hub μετρούσε «ενεργές» = `status === 'active'`, ενώ η κάρτα «Ενεργές» της σελίδας
 * συμβάσεων απαιτούσε **και** `validUntil` στο μέλλον. Μια σύμβαση με λήξη χθες μετρούσε ως ενεργή στο hub και ως
 * ληγμένη στη λίστα — η κάρτα έλεγε 2, η λίστα όπου οδηγούσε έδειχνε 1. Εδώ ζουν τα κατηγορήματα μία φορά·
 * τα διαβάζουν η κάρτα του hub, οι κάρτες της σελίδας **και** το φίλτρο `?status=` της λίστας.
 *
 * Οι κουβάδες **δεν** είναι το `FrameworkAgreementStatus`: είναι παράγωγοι (κατάσταση × ημερομηνία) και
 * επικαλύπτονται σκόπιμα (μια `expiring` είναι και `active`) — όπως ακριβώς τις μετρούσε η σελίδα.
 *
 * @module subapps/procurement/utils/framework-agreement-buckets
 */

import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';

/** Κάτω από τόσες ημέρες μια ενεργή σύμβαση «λήγει σύντομα». */
export const AGREEMENT_EXPIRING_DAYS = 30;

const DAY_MS = 86_400_000;

type BucketInput = Pick<FrameworkAgreement, 'status' | 'validUntil'>;

function validUntilMs(a: BucketInput): number {
  return a.validUntil?.toMillis?.() ?? 0;
}

/**
 * Τα κατηγορήματα — εξαντλητικό `Record`: τα κλειδιά του ΕΙΝΑΙ το λεξιλόγιο του `?status=` της λίστας
 * (`useStatusDrillParam(AGREEMENT_BUCKET_PREDICATES)`), χωρίς δεύτερη χειρόγραφη λίστα.
 */
export const AGREEMENT_BUCKET_PREDICATES = {
  active: (a: BucketInput, nowMs: number) => a.status === 'active' && validUntilMs(a) > nowMs,
  expiring: (a: BucketInput, nowMs: number) => {
    if (a.status !== 'active') return false;
    const days = (validUntilMs(a) - nowMs) / DAY_MS;
    return days >= 0 && days <= AGREEMENT_EXPIRING_DAYS;
  },
  expired: (a: BucketInput, nowMs: number) => a.status === 'expired' || validUntilMs(a) < nowMs,
  draft: (a: BucketInput) => a.status === 'draft',
} as const satisfies Record<string, (a: BucketInput, nowMs: number) => boolean>;

export type AgreementBucket = keyof typeof AGREEMENT_BUCKET_PREDICATES;

/** Ανήκει η σύμβαση σε **κάποιον** από τους κουβάδες; Κενή λίστα ⇒ χωρίς φίλτρο ⇒ ναι. */
export function matchesAgreementBuckets(
  a: BucketInput, buckets: readonly AgreementBucket[], nowMs: number,
): boolean {
  return buckets.length === 0 || buckets.some((b) => AGREEMENT_BUCKET_PREDICATES[b](a, nowMs));
}

/** Πόσες συμβάσεις ανά κουβά — ό,τι δείχνουν οι κάρτες. */
export function countAgreementBuckets(
  agreements: readonly BucketInput[], nowMs: number,
): Record<AgreementBucket, number> {
  const counts: Record<AgreementBucket, number> = { active: 0, expiring: 0, expired: 0, draft: 0 };
  for (const a of agreements) {
    for (const bucket of Object.keys(AGREEMENT_BUCKET_PREDICATES) as AgreementBucket[]) {
      if (AGREEMENT_BUCKET_PREDICATES[bucket](a, nowMs)) counts[bucket] += 1;
    }
  }
  return counts;
}
