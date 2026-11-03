/**
 * Τα **είδη άρνησης** των γραφέων της υπεργολαβίας (ADR-928 Φ1 · Φ2) — κλειστό σύνολο, το καθένα με **ένα** HTTP status.
 * Καθαρό αρχείο, χωρίς I/O: το διαβάζουν **και** ο διακομιστής (`SubcontractWriteError` → `ApiError`) **και** ο πελάτης
 * (`subcontractFailureOf`, Φ3α-2), ώστε νέο είδος να μην αποκλίνει ανάμεσα στους δύο — το ίδιο μάθημα με το
 * `catalog-write-kinds` του ADR-923, που ήταν χειρόγραφο αντίγραφο ως την 3β.
 *
 * Κάθε άρνηση της διακυβέρνησης ή του κύκλου ζωής είναι είδος: το `assertGovernance` δεν μεταγλωττίζεται αλλιώς.
 * @module subapps/procurement/subcontracts/schema/subcontract-write-kinds
 */

export const SUBCONTRACT_WRITE_ERROR_KINDS = {
  invalid: 422,
  notFound: 404,
  duplicate: 409,
  revisionMismatch: 409,
  proposalPending: 409,
  invalidTransition: 409,
  translationStale: 409,
  selfApproval: 403,
  notProposer: 403,
  // ── Κύκλος ζωής συμφωνητικού (Φ2 · `agreement-lifecycle.ts`) ──────────────
  deviationsPending: 409,
  offerExpired: 409,
  notYetExpired: 409,
  mobilizeOnOffer: 409,
} as const satisfies Readonly<Record<string, number>>;

export type SubcontractWriteErrorKind = keyof typeof SUBCONTRACT_WRITE_ERROR_KINDS;

export const SUBCONTRACT_WRITE_ERROR_KIND_NAMES = Object.keys(SUBCONTRACT_WRITE_ERROR_KINDS) as readonly SubcontractWriteErrorKind[];

/** Το πρόθεμα του `errorCode` στο σώμα της άρνησης: `subcontracts.<είδος>` — ένα σημείο για γραφέα και αναγνώστη. */
export const SUBCONTRACT_ERROR_CODE_PREFIX = 'subcontracts.';
