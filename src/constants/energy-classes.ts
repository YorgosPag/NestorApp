/**
 * =============================================================================
 * SSoT: EnergyClass Canonical Definitions (EU Standard)
 * =============================================================================
 *
 * **Single Source of Truth** για το EU energy efficiency class rating.
 * Pre-centralization, το ίδιο concept οριζόταν δύο φορές:
 *   - inline union στο `src/types/building/contracts.ts`
 *   - duplicated array στο `src/config/report-builder/domain-definitions.ts`
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από components, hooks, services.
 * Ασφαλές για import παντού (server, client, tests).
 *
 * @module constants/energy-classes
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 9)
 * @standard EU Directive 2010/31/EU (Energy Performance of Buildings)
 */

// =============================================================================
// 1. CANONICAL ARRAY — Ordered best → worst (A+ highest efficiency, G lowest)
// =============================================================================

/**
 * All canonical EnergyClass values, ordered from highest to lowest efficiency.
 * Π.χ. sorting ή rating comparison βασίζεται στο array index.
 */
export const ENERGY_CLASSES = [
  'A+',
  'A',
  'B+',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
] as const;

/** Canonical TypeScript union — derived automatically from `ENERGY_CLASSES`. */
export type EnergyClass = (typeof ENERGY_CLASSES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================

/** Returns `true` if `value` is one of the 9 canonical energy classes. */
export function isEnergyClass(value: unknown): value is EnergyClass {
  return (
    typeof value === 'string' &&
    (ENERGY_CLASSES as readonly string[]).includes(value)
  );
}

// =============================================================================
// 3. RATING HELPERS — Efficiency rank comparison
// =============================================================================

/**
 * Returns the efficiency rank (0 = best `A+`, 8 = worst `G`).
 * Throws if input is not a valid `EnergyClass` (use `isEnergyClass()` first).
 */
export function getEnergyClassRank(energyClass: EnergyClass): number {
  return (ENERGY_CLASSES as readonly string[]).indexOf(energyClass);
}

/**
 * High-efficiency classes (A+, A, B+, B) — eligible για green-building
 * incentives, premium pricing, ESG reporting.
 */
export const HIGH_EFFICIENCY_ENERGY_CLASSES = [
  'A+',
  'A',
  'B+',
  'B',
] as const satisfies readonly EnergyClass[];

export type HighEfficiencyEnergyClass =
  (typeof HIGH_EFFICIENCY_ENERGY_CLASSES)[number];

/** Returns `true` if the class is considered high-efficiency (B or better). */
export function isHighEfficiencyEnergyClass(
  value: unknown,
): value is HighEfficiencyEnergyClass {
  return (
    typeof value === 'string' &&
    (HIGH_EFFICIENCY_ENERGY_CLASSES as readonly string[]).includes(value)
  );
}
