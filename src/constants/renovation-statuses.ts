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
