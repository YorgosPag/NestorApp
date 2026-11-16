/**
 * @fileoverview ADR-915 §45.15 (1β-γ-2) — **οι λέξεις του τεκμηρίου ιδιοκτητών** στο πάνελ του γραφείου: εκκρεμής διόρθωση
 *   ΑΦΜ · «Εφαρμογή στην επαφή» · σημείωση «λείπει κάποιος». Τα μηνύματα μετά το πάτημα ζουν στο δυναμικό
 *   `registry-owner-vat-apply.ts` (CHECK 3.34 — όχι στο πρώτο καρέ).
 * @related RegistryIssuanceOwnerAttestation.tsx · registry-owner-vat-apply.ts
 * @module components/document-registry/issuance-owner-vat-labels
 *
 * ⚠️ Κυριολεκτικά κλειδιά (template σε σταθερά module): ο γεννήτορας του route slice τα **λύνει** στατικά.
 */

const K = 'document-registry:issuance.ownerVat.';

export const OWNER_VAT_KEYS = {
  heading: `${K}heading`,
  pending: `${K}pending`,
  pendingNoCurrent: `${K}pendingNoCurrent`,
  apply: `${K}apply`,
  applying: `${K}applying`,
  applied: `${K}applied`,
  unchanged: `${K}unchanged`,
  missingNote: `${K}missingNote`,
} as const;

/** Κωδικός άρνησης του route (`owner-vat-refusals.ts`) → μήνυμα· `generic` για ό,τι άλλο (δίκτυο · δικαίωμα). */
export const OWNER_VAT_REFUSAL_KEYS: Readonly<Record<string, string>> = {
  NOT_FOUND: `${K}refusals.NOT_FOUND`,
  NO_CORRECTION: `${K}refusals.NO_CORRECTION`,
  CONTACT_UNAVAILABLE: `${K}refusals.CONTACT_UNAVAILABLE`,
  generic: `${K}refusals.generic`,
};
