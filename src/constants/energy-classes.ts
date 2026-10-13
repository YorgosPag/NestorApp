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

/** Είναι τιμή της κλίμακας; Άγνωστη συμβολοσειρά ⇒ `false`, ποτέ «η πιο κοντινή». */
export function isEnergyClass(raw: unknown): raw is EnergyClass {
  return ENERGY_CLASSES.some((energyClass) => energyClass === raw);
}

// =============================================================================
// 3. RATING HELPERS — Efficiency rank comparison
// =============================================================================

/**
 * Η θέση στην κλίμακα: `0` = η καλύτερη (Α+), `ENERGY_CLASSES.length - 1` = η χειρότερη (Η).
 *
 * ⚠️ **Τάξη, όχι μέγεθος** (ADR-777 §8.94): η κλάση του ΚΕΝΑΚ βγαίνει από τον λόγο της πρωτογενούς ενέργειας προς
 * το **κτίριο αναφοράς** (ΤΟΤΕΕ 20701-1, πίν. 1.3), όχι από απόλυτα kWh — δύο κτίρια με τα ίδια kWh/m² έχουν νόμιμα
 * διαφορετική κλάση. Η βαθμίδα συγκρίνει κλάσεις· δεν μετρά απόσταση μεταξύ τους.
 */
export function energyClassRank(energyClass: EnergyClass): number {
  return ENERGY_CLASSES.indexOf(energyClass);
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
