/**
 * @fileoverview Κλειδιά i18n της επαλήθευσης κατοχής (ADR-900 §3.8) — **ένα** σημείο, εξαντλητικοί πίνακες.
 *
 * `Record<…>` πάνω στα κλειστά λεξιλόγια ⇒ νέος λόγος/κατάσταση/άρνηση **δεν μεταγλωττίζεται** χωρίς κείμενο.
 * Data file — no logic.
 */

import type { SubmitRefusal } from '@/services/ownership/ownership-verification.service';
import type { RevokeOutcome } from '@/services/ownership/ownership-verification-revoke.service';
import type {
  OwnershipReviewReason,
  OwnershipRevocationReason,
  OwnershipVerificationStatus,
} from '@/types/ownership-verification';

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
  // ADR-900 §8 #2 Β3 — αποδέσμευση από τον ίδιο (σχήμα Zillow «unclaim»).
  release: `${P}.release`,
  releasing: `${P}.releasing`,
  releaseConfirmTitle: `${P}.releaseConfirmTitle`,
  releaseConfirmBody: `${P}.releaseConfirmBody`,
  revocationReasonLabel: `${P}.revocation.reasonLabel`,
} as const;

/**
 * Τίτλος + λεπτομέρεια ανά κατάσταση. `superseded` = «άλλος επαλήθευσε τον ΚΑΕΚ»· `revoked` λέγεται **με τον λόγο
 * του** ({@link REVOCATION_REASON_KEYS}) — σχήμα Google Business Profile: κάθε απόφαση με λόγο.
 */
export const STATUS_KEYS: Readonly<Record<OwnershipVerificationStatus, { readonly title: string; readonly detail: string }>> = {
  verified: { title: `${P}.status.verified`, detail: `${P}.status.verifiedDetail` },
  'pending-review': { title: `${P}.status.pendingReview`, detail: `${P}.status.pendingReviewDetail` },
  rejected: { title: `${P}.status.rejected`, detail: `${P}.status.rejectedDetail` },
  superseded: { title: `${P}.status.inactive`, detail: `${P}.status.inactiveDetail` },
  revoked: { title: `${P}.status.revoked`, detail: `${P}.status.revokedDetail` },
};

/** Ο λόγος ανάκλησης — **ένα** κείμενο για τον διαχειριστή (επιλογή) **και** τον κάτοχο (εξήγηση). */
export const REVOCATION_REASON_KEYS: Readonly<Record<OwnershipRevocationReason, string>> = {
  'evidence-invalid': `${P}.revocation.reasons.evidenceInvalid`,
  'claimed-in-error': `${P}.revocation.reasons.claimedInError`,
  'ownership-ended': `${P}.revocation.reasons.ownershipEnded`,
  'owner-request': `${P}.revocation.reasons.ownerRequest`,
};

/** Οι αρνήσεις της ανάκλησης (και των δύο πορτών) + η βλάβη. */
export const REVOKE_ERROR_KEYS: Readonly<Record<Extract<RevokeOutcome, { kind: 'refused' }>['reason'] | 'UNAVAILABLE', string>> = {
  'not-found': `${P}.revocation.errors.notFound`,
  'not-revocable': `${P}.revocation.errors.notRevocable`,
  'reason-not-allowed': `${P}.revocation.errors.reasonNotAllowed`,
  UNAVAILABLE: `${P}.errors.unavailable`,
};

export type RevokeErrorCode = keyof typeof REVOKE_ERROR_KEYS;

/** Κωδικός από το σύρμα → κλειστό σύνολο· ό,τι άγνωστο είναι βλάβη. */
export function revokeErrorCodeOf(code: unknown): RevokeErrorCode {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(REVOKE_ERROR_KEYS, code)
    ? (code as RevokeErrorCode)
    : 'UNAVAILABLE';
}

/** Η ουρά διαχειριστή — κείμενα στο `property-market` (κοπή ανά κλειδί), **όχι** στο `admin` (ολόκληρο στο κέλυφος). */
const R = `${P}.revocation`;

export const REVOCATION_ADMIN_KEYS = {
  tabPending: `${R}.tabPending`,
  tabVerified: `${R}.tabVerified`,
  searchLabel: `${R}.searchLabel`,
  searchHint: `${R}.searchHint`,
  search: `${R}.search`,
  searchMalformed: `${R}.searchMalformed`,
  noResults: `${R}.noResults`,
  statusVerified: `${R}.statusVerified`,
  statusSuperseded: `${R}.statusSuperseded`,
  revoke: `${R}.revoke`,
  confirmTitle: `${R}.confirmTitle`,
  confirmBody: `${R}.confirmBody`,
  unitWillRetire: `${R}.unitWillRetire`,
  unitStays: `${R}.unitStays`,
} as const;

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
