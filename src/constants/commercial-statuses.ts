/**
 * =============================================================================
 * SSoT: CommercialStatus Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για το commercial (sales/rental) status ενός unit.
 * Πριν από αυτό το module, το ίδιο concept οριζόταν δύο φορές:
 *   - inline union στο `src/types/property.ts`
 *   - duplicated array στο `src/config/report-builder/domain-definitions.ts`
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * **Προσθήκη νέας κατάστασης**: Πρόσθεσε entry στο `COMMERCIAL_STATUSES` array +
 * i18n keys σε `properties-enums.json`. Τα πάντα άλλα derive αυτόματα.
 *
 * @module constants/commercial-statuses
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 * @see ADR-197 — Sales Pages Implementation (canonical origin)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Single point of addition για νέες καταστάσεις
// =============================================================================

/**
 * All canonical CommercialStatus values, in natural lifecycle order.
 *
 * - `unavailable`         — Μη διαθέσιμη (default — not on market)
 * - `for-sale`            — Προς πώληση
 * - `for-rent`            — Προς ενοικίαση
 * - `for-sale-and-rent`   — Πώληση & Ενοικίαση (dual listing)
 * - `reserved`            — Κρατημένη (προκαταβολή)
 * - `sold`                — Πωλημένη
 * - `rented`              — Ενοικιασμένη
 */
export const COMMERCIAL_STATUSES = [
  'unavailable',
  'for-sale',
  'for-rent',
  'for-sale-and-rent',
  'reserved',
  'sold',
  'rented',
] as const;

/** Canonical TypeScript union — derived automatically from `COMMERCIAL_STATUSES`. */
export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

/** Returns `true` if `value` is one of the 7 canonical commercial statuses. */
export function isCommercialStatus(value: unknown): value is CommercialStatus {
  return (
    typeof value === 'string' &&
    (COMMERCIAL_STATUSES as readonly string[]).includes(value)
  );
}

// =============================================================================
// 3. DERIVED SUBSETS — Active listings vs finalized transactions
// =============================================================================

/**
 * Statuses που σημαίνουν ενεργή διάθεση στην αγορά (listed for a transaction).
 * Χρησιμοποιείται από sales dashboards / available-properties filters.
 */
export const LISTED_COMMERCIAL_STATUSES = [
  'for-sale',
  'for-rent',
  'for-sale-and-rent',
] as const satisfies readonly CommercialStatus[];

export type ListedCommercialStatus = (typeof LISTED_COMMERCIAL_STATUSES)[number];

/**
 * Statuses που σημαίνουν ολοκληρωμένη συναλλαγή (finalized deal).
 * Χρησιμοποιείται από reports / revenue aggregators.
 */
export const FINALIZED_COMMERCIAL_STATUSES = [
  'sold',
  'rented',
] as const satisfies readonly CommercialStatus[];

export type FinalizedCommercialStatus =
  (typeof FINALIZED_COMMERCIAL_STATUSES)[number];

/** Returns `true` if `value` represents an active market listing. */
export function isListedCommercialStatus(
  value: unknown,
): value is ListedCommercialStatus {
  return (
    typeof value === 'string' &&
    (LISTED_COMMERCIAL_STATUSES as readonly string[]).includes(value)
  );
}

/** Returns `true` if `value` represents a finalized transaction. */
export function isFinalizedCommercialStatus(
  value: unknown,
): value is FinalizedCommercialStatus {
  return (
    typeof value === 'string' &&
    (FINALIZED_COMMERCIAL_STATUSES as readonly string[]).includes(value)
  );
}
