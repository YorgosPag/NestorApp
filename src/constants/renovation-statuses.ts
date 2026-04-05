/**
 * =============================================================================
 * SSoT: RenovationStatus Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για το renovation status ενός κτιρίου.
 * Pre-centralization, το concept οριζόταν inline στο
 * `src/types/building/contracts.ts`.
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/renovation-statuses
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 */

// =============================================================================
// 1. CANONICAL ARRAY
// =============================================================================

/**
 * All canonical RenovationStatus values.
 *
 * - `none`    — Χωρίς ανακαίνιση
 * - `partial` — Μερική ανακαίνιση
 * - `full`    — Πλήρης ανακαίνιση
 * - `planned` — Προγραμματισμένη ανακαίνιση
 */
export const RENOVATION_STATUSES = [
  'none',
  'partial',
  'full',
  'planned',
] as const;

/** Canonical TypeScript union — derived automatically from `RENOVATION_STATUSES`. */
export type RenovationStatus = (typeof RENOVATION_STATUSES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

/** Returns `true` if `value` is one of the 4 canonical renovation statuses. */
export function isRenovationStatus(value: unknown): value is RenovationStatus {
  return (
    typeof value === 'string' &&
    (RENOVATION_STATUSES as readonly string[]).includes(value)
  );
}

// =============================================================================
// 3. DERIVED SUBSETS — Completed vs pending renovation
// =============================================================================

/** Statuses σημαίνουσες υπάρχουσα (ολοκληρωμένη) ανακαίνιση. */
export const COMPLETED_RENOVATION_STATUSES = [
  'partial',
  'full',
] as const satisfies readonly RenovationStatus[];

export type CompletedRenovationStatus =
  (typeof COMPLETED_RENOVATION_STATUSES)[number];

/** Returns `true` if a renovation has been executed (partial ή full). */
export function isCompletedRenovationStatus(
  value: unknown,
): value is CompletedRenovationStatus {
  return (
    typeof value === 'string' &&
    (COMPLETED_RENOVATION_STATUSES as readonly string[]).includes(value)
  );
}
