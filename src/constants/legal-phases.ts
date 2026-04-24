/**
 * =============================================================================
 * SSoT: LegalPhase Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για τη νομική φάση (legal phase) ενός ακινήτου.
 *
 * Αντικατοπτρίζει την σύνθεση `ContractPhase` (preliminary/final/payoff) και
 * `ContractStatus` (draft/pending_signature/signed/completed) στο υψηλότερο
 * contract της αλυσίδας — υπολογίζεται από το `LegalContractService` (ADR-230)
 * και αποθηκεύεται denormalized στο `property.commercial.legalPhase`.
 *
 * Pre-centralization, το concept οριζόταν σε 3 σημεία με drift:
 *   - canonical inline union στο `src/types/legal-contracts.ts` (7 values)
 *   - λανθασμένο 6-value array στο `src/config/report-builder/domain-definitions.ts`
 *     (['initial','deedPrep','documentReview','signaturePending','completed','cancelled'])
 *   - ίδιο λανθασμένο array στο `src/config/report-builder/domain-defs-buyers.ts`
 *
 * Οι 6 τιμές του παλιού report-builder **δεν ταιριάζουν ποτέ** με τα πραγματικά
 * δεδομένα του field — filter-by-`initial` δεν επέστρεφε αποτελέσματα. Το ADR-287
 * Batch 9F-4/5 το διορθώνει: όλα τα consumers τώρα χρησιμοποιούν το
 * canonical 7-value enum.
 *
 * **Layering**: Leaf module — καμία εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/legal-phases
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 * @see ADR-230 — Legal Contracts FSM (canonical origin)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Ordered κατά τη ροή συμβολαιογραφικής διαδικασίας
// =============================================================================

/**
 * All canonical LegalPhase values — ordered κατά την πρόοδο του
 * conveyancing workflow (από `none` → `payoff_completed`).
 *
 * - `none`                — Χωρίς σύμβαση / καμία νομική φάση
 * - `preliminary_pending` — Προσύμφωνο σε εκκρεμότητα
 * - `preliminary_signed`  — Προσύμφωνο υπογεγραμμένο
 * - `final_pending`       — Οριστικό σε εκκρεμότητα
 * - `final_signed`        — Οριστικό υπογεγραμμένο
 * - `payoff_pending`      — Εξόφληση σε εκκρεμότητα
 * - `payoff_completed`    — Εξόφληση ολοκληρωμένη (τερματική φάση)
 */
export const LEGAL_PHASES = [
  'none',
  'preliminary_pending',
  'preliminary_signed',
  'final_pending',
  'final_signed',
  'payoff_pending',
  'payoff_completed',
] as const;

/** Canonical TypeScript union — derived automatically από `LEGAL_PHASES`. */
export type LegalPhase = (typeof LEGAL_PHASES)[number];

// =============================================================================
// 2. DERIVED SUBSETS
// =============================================================================

/** Phases με pending contract που αναμένει υπογραφή. */
export const PENDING_LEGAL_PHASES = [
  'preliminary_pending',
  'final_pending',
  'payoff_pending',
] as const satisfies readonly LegalPhase[];

export type PendingLegalPhase = (typeof PENDING_LEGAL_PHASES)[number];

/** Phases με υπογεγραμμένο ή ολοκληρωμένο contract. */
export const SIGNED_LEGAL_PHASES = [
  'preliminary_signed',
  'final_signed',
  'payoff_completed',
] as const satisfies readonly LegalPhase[];

export type SignedLegalPhase = (typeof SIGNED_LEGAL_PHASES)[number];

