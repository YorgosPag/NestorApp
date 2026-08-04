/**
 * Landowner acquisition status — SSoT for the per-landowner acquisition stage.
 *
 * Pure business logic. No React, no UI, no side effects.
 * Sibling of `owner-utils.ts`, which is orthogonal: that one owns *percentage
 * validation* for `PropertyOwnerEntry` (sales domain) and knows nothing about
 * acquisition.
 *
 * @module lib/ownership/landowner-acquisition
 * @enterprise ADR-244 (Landowners) · ADR-745 Φ3α (Q1 — πού ανήκει ο «ΕΡΓΟΔΟΤΗΣ»)
 */

import {
  ACQUISITION_STATUS_TRANSITIONS,
  ACQUISITION_STATUSES,
  type AcquisitionStatus,
  type LandownerEntry,
} from '@/types/ownership-table';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Ποια από τις τρεις εικόνες δείχνει η σύνοψη.
 *
 * 🔑 Ζει **εδώ** και όχι στο UI: «κανείς δεν δήλωσε» και «όλοι δήλωσαν, κανείς
 * δεν κλείδωσε» δίνουν **και τα δύο** 0%, αλλά είναι διαφορετικά πράγματα.
 * Αν το UI αποφάσιζε μόνο του με `declaredCount === 0`, θα υπήρχαν δύο πηγές
 * για την ίδια ερώτηση.
 */
export type AcquisitionSummaryKind =
  | 'none'      // καμία δήλωση — μην δείξεις ποσοστό, θα φαινόταν σαν βλάβη
  | 'partial'   // κάποιοι δήλωσαν — δείξε ποσοστό ΜΕ ρητή την ατέλεια
  | 'complete'; // όλοι δήλωσαν — το ποσοστό στέκει μόνο του

export interface AcquisitionSummary {
  readonly kind: AcquisitionSummaryKind;
  /** Άθροισμα ποσοστών όσων είναι **ρητά** `secured` */
  readonly securedPct: number;
  /** Πόσοι έχουν οποιαδήποτε ρητή κατάσταση */
  readonly declaredCount: number;
  /** Πόσοι **δεν** έχουν */
  readonly undeclaredCount: number;
  readonly totalCount: number;
}

// ============================================================================
// GUARDS
// ============================================================================

/**
 * Type guard για τιμή που έρχεται από Firestore/JSON.
 * Χρειάζεται επειδή το πεδίο είναι προαιρετικό και τα παλιά έγγραφα δεν το έχουν.
 */
export function isAcquisitionStatus(value: unknown): value is AcquisitionStatus {
  return typeof value === 'string'
    && (ACQUISITION_STATUSES as readonly string[]).includes(value);
}

/**
 * Επιτρέπεται η μετάβαση `from → to`;
 * Ίδια τιμή = πάντα επιτρεπτή (no-op), όπως και η **πρώτη** δήλωση από «δεν δηλώθηκε».
 */
export function canTransition(
  from: AcquisitionStatus | undefined,
  to: AcquisitionStatus,
): boolean {
  if (from === undefined) return true;
  if (from === to) return true;
  return ACQUISITION_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Οι επιτρεπτοί προορισμοί από την τρέχουσα κατάσταση, **μαζί** με την τρέχουσα.
 * Το UI το χρησιμοποιεί για να μη δείχνει επιλογές που θα απορριφθούν.
 */
export function allowedTransitionsFrom(
  from: AcquisitionStatus | undefined,
): readonly AcquisitionStatus[] {
  if (from === undefined) return ACQUISITION_STATUSES;
  return ACQUISITION_STATUSES.filter(s => s === from || canTransition(from, s));
}

// ============================================================================
// SUMMARY
// ============================================================================

/** Στρογγυλοποίηση σε 2 δεκαδικά — 33.33 × 2 = 66.66, όχι 66.66000000000001 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Πόσο του οικοπέδου έχει **πραγματικά** κλειδώσει.
 *
 * Μετρά **μόνο** ρητά `secured` — ποτέ δεν συμπεραίνει από απουσία.
 * Το καθοριστικό σενάριο: οικόπεδο τριών αδελφών από ⅓· δύο υπέγραψαν οριστικό,
 * ο τρίτος δεν έχει δηλωθεί ⇒ `securedPct = 66.66`, `undeclaredCount = 1`,
 * `kind = 'partial'` — και το UI οφείλει να πει **και τα δύο**.
 */
export function summarizeAcquisition(
  entries: readonly LandownerEntry[],
): AcquisitionSummary {
  const totalCount = entries.length;
  const declared = entries.filter(e => isAcquisitionStatus(e.acquisitionStatus));
  const declaredCount = declared.length;

  const securedPct = round2(
    declared
      .filter(e => e.acquisitionStatus === 'secured')
      .reduce((sum, e) => sum + e.landOwnershipPct, 0),
  );

  const kind: AcquisitionSummaryKind = declaredCount === 0
    ? 'none'
    : declaredCount === totalCount ? 'complete' : 'partial';

  return {
    kind,
    securedPct,
    declaredCount,
    undeclaredCount: totalCount - declaredCount,
    totalCount,
  };
}
