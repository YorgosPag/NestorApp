/**
 * =============================================================================
 * SSoT: LegalWorkflowPhase Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για τις φάσεις ενός legal workflow (conveyancing
 * process) όπως εμφανίζονται σε report-builder dropdowns & filter UIs.
 *
 * Pre-centralization, το ίδιο 6-value array οριζόταν σε **δύο** σημεία:
 *   - `src/config/report-builder/domain-definitions.ts` (properties domain)
 *   - `src/config/report-builder/domain-defs-buyers.ts` (buyers domain)
 *
 * ⚠️ **ΠΡΟΣΟΧΗ — ΟΧΙ ΙΔΙΟ με `LegalPhase` στο `src/types/legal-contracts.ts`**:
 * Ο τύπος `LegalPhase` στο `@/types/legal-contracts` περιγράφει τη _νομική_
 * φάση ενός ακινήτου όπως υπολογίζεται από τα contracts (FSM του ADR-230), με
 * τιμές `'none' | 'preliminary_pending' | 'preliminary_signed' | 'final_pending'
 * | 'final_signed' | 'payoff_pending' | 'payoff_completed'` (7 values).
 *
 * Το τρέχον SSoT (`LegalWorkflowPhase`) περιγράφει το generic conveyancing
 * workflow για report-builder filters (6 values με διαφορετική semantics).
 * Τα δύο concepts **δεν** ταυτίζονται· η αρμονοποίηση/merge αποτελεί θέμα
 * ξεχωριστής απόφασης (πιθανό follow-up ADR).
 *
 * **Layering**: Leaf module — καμία εξάρτηση από components, hooks, services.
 *
 * @module constants/legal-phases
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Ordered κατά τη ροή του conveyancing workflow
// =============================================================================

/**
 * All canonical LegalWorkflowPhase values (report-builder filter enum).
 *
 * - `initial`           — Αρχική φάση (πριν ξεκινήσει νομική διαδικασία)
 * - `deedPrep`          — Προετοιμασία συμβολαίου
 * - `documentReview`    — Έλεγχος εγγράφων
 * - `signaturePending`  — Εκκρεμής υπογραφή
 * - `completed`         — Ολοκληρωμένη διαδικασία
 * - `cancelled`         — Ακυρωμένη
 */
export const LEGAL_WORKFLOW_PHASES = [
  'initial',
  'deedPrep',
  'documentReview',
  'signaturePending',
  'completed',
  'cancelled',
] as const;

/**
 * Canonical TypeScript union — derived automatically από
 * `LEGAL_WORKFLOW_PHASES`.
 */
export type LegalWorkflowPhase = (typeof LEGAL_WORKFLOW_PHASES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

/**
 * Returns `true` if `value` is one of the 6 canonical legal workflow phases.
 */
export function isLegalWorkflowPhase(
  value: unknown,
): value is LegalWorkflowPhase {
  return (
    typeof value === 'string' &&
    (LEGAL_WORKFLOW_PHASES as readonly string[]).includes(value)
  );
}

// =============================================================================
// 3. DERIVED SUBSETS — In-progress vs finalized phases
// =============================================================================

/**
 * Phases που σημαίνουν ενεργή (σε εξέλιξη) νομική διαδικασία.
 * Χρησιμοποιείται για workload dashboards / pending-work reports.
 */
export const IN_PROGRESS_LEGAL_PHASES = [
  'deedPrep',
  'documentReview',
  'signaturePending',
] as const satisfies readonly LegalWorkflowPhase[];

export type InProgressLegalPhase = (typeof IN_PROGRESS_LEGAL_PHASES)[number];

/** Returns `true` if the workflow is currently being processed. */
export function isInProgressLegalPhase(
  value: unknown,
): value is InProgressLegalPhase {
  return (
    typeof value === 'string' &&
    (IN_PROGRESS_LEGAL_PHASES as readonly string[]).includes(value)
  );
}

/**
 * Phases που σημαίνουν τερματική κατάσταση του workflow
 * (completed ή cancelled).
 */
export const FINALIZED_LEGAL_PHASES = [
  'completed',
  'cancelled',
] as const satisfies readonly LegalWorkflowPhase[];

export type FinalizedLegalPhase = (typeof FINALIZED_LEGAL_PHASES)[number];

/** Returns `true` if the workflow has reached a terminal state. */
export function isFinalizedLegalPhase(
  value: unknown,
): value is FinalizedLegalPhase {
  return (
    typeof value === 'string' &&
    (FINALIZED_LEGAL_PHASES as readonly string[]).includes(value)
  );
}
