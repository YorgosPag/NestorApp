/**
 * @fileoverview Κλειδιά i18n της επαλήθευσης κατοχής (ADR-900 §3.8) — **ένα** σημείο, εξαντλητικοί πίνακες.
 *
 * `Record<…>` πάνω στα κλειστά λεξιλόγια ⇒ νέος λόγος/κατάσταση/άρνηση **δεν μεταγλωττίζεται** χωρίς κείμενο.
 * Data file — no logic.
 */

import type { SubmitRefusal } from '@/services/ownership/ownership-verification.service';
import type { OwnershipReviewReason, OwnershipVerificationStatus } from '@/types/ownership-verification';

export const OWNERSHIP_NS = 'property-market';

const P = 'property-market:ownershipVerification';

export const OWNERSHIP_KEYS = {
  heading: `${P}.heading`,
  intro: `${P}.intro`,
  howTo: `${P}.howTo`,
  upload: `${P}.upload`,
  uploadAgain: `${P}.uploadAgain`,
  submitting: `${P}.submitting`,
  loading: `${P}.loading`,
  unavailable: `${P}.unavailable`,
  noDossier: `${P}.noDossier`,
  privacy: `${P}.privacy`,
  reasonsHeading: `${P}.reasonsHeading`,
  remedyProfile: `${P}.remedyProfile`,
} as const;

/** Τίτλος + λεπτομέρεια ανά κατάσταση. `superseded`/`revoked` λέγονται ίδια: «δεν ισχύει πλέον». */
export const STATUS_KEYS: Readonly<Record<OwnershipVerificationStatus, { readonly title: string; readonly detail: string }>> = {
  verified: { title: `${P}.status.verified`, detail: `${P}.status.verifiedDetail` },
  'pending-review': { title: `${P}.status.pendingReview`, detail: `${P}.status.pendingReviewDetail` },
  rejected: { title: `${P}.status.rejected`, detail: `${P}.status.rejectedDetail` },
  superseded: { title: `${P}.status.inactive`, detail: `${P}.status.inactiveDetail` },
  revoked: { title: `${P}.status.inactive`, detail: `${P}.status.inactiveDetail` },
};

export const REASON_KEYS: Readonly<Record<OwnershipReviewReason, string>> = {
  'seal-invalid': `${P}.reasons.sealInvalid`,
  'issuer-unconfirmed': `${P}.reasons.issuerUnconfirmed`,
  'stale-certificate': `${P}.reasons.staleCertificate`,
  'kaek-unreadable': `${P}.reasons.kaekUnreadable`,
  'beneficiaries-unreadable': `${P}.reasons.beneficiariesUnreadable`,
  'tax-id-absent': `${P}.reasons.taxIdAbsent`,
  'tax-id-mismatch': `${P}.reasons.taxIdMismatch`,
  'name-mismatch': `${P}.reasons.nameMismatch`,
  'kaek-claimed-elsewhere': `${P}.reasons.kaekClaimedElsewhere`,
  'tax-id-claimed-elsewhere': `${P}.reasons.taxIdClaimedElsewhere`,
};

/** Οι αρνήσεις της υποβολής + η βλάβη. Το `identity-incomplete` έχει και **διέξοδο** (προφίλ). */
export const SUBMIT_ERROR_KEYS: Readonly<Record<SubmitRefusal | 'UNAVAILABLE', string>> = {
  'not-your-property': `${P}.errors.notYourProperty`,
  'identity-incomplete': `${P}.errors.identityIncomplete`,
  'certificate-too-large': `${P}.errors.certificateTooLarge`,
  'certificate-missing': `${P}.errors.certificateMissing`,
  'certificate-not-yours': `${P}.errors.certificateMissing`,
  'certificate-not-ready': `${P}.errors.certificateNotReady`,
  'certificate-not-pdf': `${P}.errors.certificateNotPdf`,
  UNAVAILABLE: `${P}.errors.unavailable`,
};

export type SubmitErrorCode = keyof typeof SUBMIT_ERROR_KEYS;

/** Κωδικός από το σύρμα → κλειστό σύνολο· ό,τι άγνωστο είναι βλάβη («ξαναδοκίμασε»), ποτέ άρνηση. */
export function submitErrorCodeOf(code: unknown): SubmitErrorCode {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(SUBMIT_ERROR_KEYS, code)
    ? (code as SubmitErrorCode)
    : 'UNAVAILABLE';
}
