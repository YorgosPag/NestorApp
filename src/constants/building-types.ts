/**
 * =============================================================================
 * SSoT: BuildingType Canonical Definitions
 * =============================================================================
 *
 * **Single Source of Truth** για το type ενός κτιρίου (construction industry).
 * Pre-centralization, το ίδιο concept οριζόταν δύο φορές:
 *   - inline union στο `src/types/building/contracts.ts`
 *   - duplicated array στο `src/config/report-builder/domain-definitions.ts`
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/building-types
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Single point of addition για νέους τύπους κτιρίων
// =============================================================================

/**
 * All canonical BuildingType values.
 *
 * - `residential` — Κατοικία
 * - `commercial`  — Εμπορικό
 * - `industrial`  — Βιομηχανικό
 * - `mixed`       — Μικτή χρήση
 * - `office`      — Γραφεία
 * - `warehouse`   — Αποθήκη
 */
export const BUILDING_TYPES = [
  'residential',
  'commercial',
  'industrial',
  'mixed',
  'office',
  'warehouse',
] as const;

/** Canonical TypeScript union — derived automatically from `BUILDING_TYPES`. */
export type BuildingType = (typeof BUILDING_TYPES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

/** Returns `true` if `value` is one of the 6 canonical building types. */
export function isBuildingType(value: unknown): value is BuildingType {
  return (
    typeof value === 'string' &&
    (BUILDING_TYPES as readonly string[]).includes(value)
  );
}

// =============================================================================
// 3. DERIVED SUBSETS — Residential vs Non-residential classification
// =============================================================================

/**
 * Non-residential building types — commercial/industrial/office/warehouse use.
 * Χρησιμοποιείται για zoning filters, regulatory compliance rules.
 */
export const NON_RESIDENTIAL_BUILDING_TYPES = [
  'commercial',
  'industrial',
  'office',
  'warehouse',
] as const satisfies readonly BuildingType[];

export type NonResidentialBuildingType =
  (typeof NON_RESIDENTIAL_BUILDING_TYPES)[number];

/** Returns `true` if the building is non-residential (commercial-leaning). */
export function isNonResidentialBuildingType(
  value: unknown,
): value is NonResidentialBuildingType {
  return (
    typeof value === 'string' &&
    (NON_RESIDENTIAL_BUILDING_TYPES as readonly string[]).includes(value)
  );
}
