/**
 * @fileoverview Τύποι της επιβεβαίωσης προμηθευτή (ADR-923 §5.13 Ε1α · Ε1β).
 * @module subapps/catalog/types/supplier-verification
 *
 * Κανένα πεδίο δεν κρατά ΑΦΜ: μόνο αποτύπωμα HMAC, από το `supplier-tax-fingerprint.server.ts`.
 */

/** Ό,τι κρατάμε από έναν έλεγχο ΑΦΜ. Το `undetermined` δεν αποθηκεύεται ποτέ: η άγνοια δεν είναι ετυμηγορία. */
export interface StoredTaxBinding {
  readonly outcome: 'matched' | 'mismatched' | 'not-found';
  readonly taxFingerprint: string;
  readonly registrationNumber: string;
  readonly checkedAt: string;
}

/** Τα στοιχεία του χώρου σήμερα. `taxFingerprint: null` ⇒ λείπει ή δεν είναι έγκυρο το ΑΦΜ. */
export interface SupplierIdentityFacts {
  readonly legalName: string | null;
  readonly gemiNumber: string | null;
  readonly taxFingerprint: string | null;
}

/** Ό,τι είδε ο διαχειριστής όταν ενέκρινε. Αλλάζει κάτι ⇒ η έγκριση παύει να ισχύει (§16). */
export type SupplierApprovalSnapshot = SupplierIdentityFacts;

export type SupplierStanding =
  | { readonly kind: 'verified'; readonly basis: 'registry' | 'manual-review' }
  | { readonly kind: 'unverified' };

/**
 * Τρεις εκβάσεις, όχι δύο: η βλάβη δεν είναι «χωρίς έγκριση». Όποιος αφαιρεί κάτι επειδή ο προμηθευτής δεν είναι
 * επιβεβαιωμένος ρωτά αυτό εδώ, αλλιώς ένα 5xx θα έσβηνε δημοσιευμένα δεδομένα.
 */
export type SupplierStandingRead =
  | { readonly kind: 'known'; readonly standing: SupplierStanding }
  | { readonly kind: 'unknown' };

/**
 * `public_supplier_showcases/{companyId}`: το αντίγραφο της ετυμηγορίας για τον ανώνυμο. Η ύπαρξή του σημαίνει ότι ο
 * προμηθευτής δημοσίευσε ρητά. Κανένα ποσό, κανένα ΑΦΜ ή αποτύπωμα.
 */
export interface SupplierShowcaseRecord {
  readonly companyId: string;
  readonly legalName: string;
  readonly basis: Extract<SupplierStanding, { kind: 'verified' }>['basis'];
  readonly publishedAt: string;
  readonly updatedAt: string;
}

export const SUPPLIER_REVIEW_STATUSES = ['pending-review', 'approved', 'rejected', 'revoked'] as const;
export type SupplierReviewStatus = (typeof SUPPLIER_REVIEW_STATUSES)[number];

/**
 * Ένα έγγραφο ανά χώρο (`supplier_verifications/{companyId}`), άρα δομικά μία εκκρεμής αίτηση.
 * `approval` υπάρχει μόνο σε `approved`: είναι τα `submitted` της στιγμής της απόφασης, όχι τα τρέχοντα στοιχεία.
 */
export interface SupplierReviewRecord {
  readonly companyId: string;
  readonly status: SupplierReviewStatus;
  readonly submitted: SupplierIdentityFacts;
  readonly taxBinding: StoredTaxBinding | null;
  readonly evidenceFileId: string;
  readonly approval: SupplierApprovalSnapshot | null;
  /** Η θέση στην ουρά: κρατιέται όταν ανανεώνεται εκκρεμής αίτηση. */
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
  readonly reviewNote: string | null;
}
