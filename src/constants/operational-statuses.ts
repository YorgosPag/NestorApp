/**
 * =============================================================================
 * SSoT: OperationalStatus Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για το operational (physical/construction) status
 * ενός unit. Pre-centralization, το ίδιο concept οριζόταν δύο φορές:
 *   - inline union στο `src/types/property.ts`
 *   - duplicated array στο `src/config/report-builder/domain-definitions.ts`
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/operational-statuses
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Single point of addition για νέες καταστάσεις
// =============================================================================

/**
 * All canonical OperationalStatus values, in natural lifecycle order.
 *
 * - `draft`              — Πρόχειρο (data entry, not finalized)
 * - `under-construction` — Υπό κατασκευή
 * - `inspection`         — Σε επιθεώρηση
 * - `maintenance`        — Υπό συντήρηση
 * - `ready`              — Έτοιμο (construction complete)
 */
export const OPERATIONAL_STATUSES = [
  'draft',
  'under-construction',
  'inspection',
  'maintenance',
  'ready',
] as const;

/** Canonical TypeScript union — derived automatically from `OPERATIONAL_STATUSES`. */
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================


// =============================================================================
// 3. DERIVED SUBSETS — In-progress vs terminal states
// =============================================================================

/**
 * Statuses που σημαίνουν active/in-progress physical work (σε εξέλιξη).
 * Χρησιμοποιείται από progress dashboards / construction-phase filters.
 */
export const IN_PROGRESS_OPERATIONAL_STATUSES = [
  'under-construction',
  'inspection',
  'maintenance',
] as const satisfies readonly OperationalStatus[];
// =============================================================================
// 4. PRE-COMPLETION SUBSET — Google-style progressive disclosure
// =============================================================================

/**
 * Statuses που σημαίνουν ότι το unit δεν έχει φτάσει ακόμα σε completed state
 * και επομένως ελλιπή data (finishes, systems, ΠΕΑ/energy class) θεωρούνται
 * legitimate absence, όχι data-quality violation.
 *
 * **Semantic**: Pre-completion = "construction / data-entry phase". Missing
 * warnings για finishes/systems/energyClass σωπαίνουν — ο χρήστης δεν έχει
 * ακόμα τη δυνατότητα να τα καταχωρήσει (δεν τα έχει εγκαταστήσει / το ΠΕΑ
 * εκδίδεται στην αποπεράτωση / το draft είναι απλώς stub).
 *
 * **Cross-field declarative warnings** (π.χ. user δήλωσε ρητά heating=none +
 * condition=new) ΠΑΡΑΜΕΝΟΥΝ active — είναι εσωτερική ασυνέπεια, όχι missing.
 *
 * **Orientation** δεν περιλαμβάνεται — είναι geometry foundation-level, γνωστή
 * από τη στιγμή της θεμελίωσης.
 *
 * @see ADR-287 Batch 27 — operationalStatus-aware missing gating
 */
export const PRE_COMPLETION_OPERATIONAL_STATUSES = [
  'draft',
  'under-construction',
] as const satisfies readonly OperationalStatus[];

export type PreCompletionOperationalStatus =
  (typeof PRE_COMPLETION_OPERATIONAL_STATUSES)[number];

/**
 * Returns `true` if the unit is in a pre-completion state, where missing-data
 * warnings should be suppressed (Google-style progressive disclosure).
 */
export function isPreCompletionOperationalStatus(
  value: unknown,
): value is PreCompletionOperationalStatus {
  return (
    typeof value === 'string' &&
    (PRE_COMPLETION_OPERATIONAL_STATUSES as readonly string[]).includes(value)
  );
}
