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

/** Returns `true` if `value` is one of the 5 canonical operational statuses. */
export function isOperationalStatus(value: unknown): value is OperationalStatus {
  return (
    typeof value === 'string' &&
    (OPERATIONAL_STATUSES as readonly string[]).includes(value)
  );
}

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

export type InProgressOperationalStatus =
  (typeof IN_PROGRESS_OPERATIONAL_STATUSES)[number];

/** Returns `true` if the unit is in some form of active physical state. */
export function isInProgressOperationalStatus(
  value: unknown,
): value is InProgressOperationalStatus {
  return (
    typeof value === 'string' &&
    (IN_PROGRESS_OPERATIONAL_STATUSES as readonly string[]).includes(value)
  );
}
