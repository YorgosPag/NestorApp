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
