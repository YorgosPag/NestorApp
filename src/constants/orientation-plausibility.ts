/**
 * =============================================================================
 * SSoT: Orientation Plausibility (Google-style sanity check)
 * =============================================================================
 *
 * **Single Source of Truth** για το "are the selected orientations plausible
 * for this property type?" check. Εμφανίζεται σαν inline non-blocking warning
 * όταν ο χρήστης επιλέγει συνδυασμό προσανατολισμών που δεν συνάδει με τον
 * τύπο (π.χ. διαμέρισμα με 7 προσανατολισμούς, βίλα χωρίς κανέναν).
 *
 * **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save.
 * Ο χρήστης μπορεί να έχει legitimate reason (corner unit με 3 προσανατολισμούς,
 * loft με ασύμμετρη γεωμετρία). Warning = UX hint για να πιάσει typos.
 *
 * **Layering**: Leaf module — εξαρτάται μόνο από `property-types.ts`. Ασφαλές
 * για import παντού (server, client, tests).
 *
 * **Priority order** (most severe first, single-reason surfacing):
 *   1. `commercialAllDirections`  — shop/office με ≥4 προσανατολισμούς (unusual)
 *   2. `allEightNonStandalone`    — και οι 8 σε non-villa/detached (unusual)
 *   3. `tooMany`                  — ≥5 σε non-standalone residential (unusual)
 *   4. `missingResidential`       — απαιτείται ≥1 για residential (unusual)
 *
 * @module constants/orientation-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 24)
 */

import {
  isStandaloneUnitType,
  type PropertyTypeCanonical,
} from '@/constants/property-types';

// =============================================================================
// 1. PER-TYPE RULES
// =============================================================================

export interface OrientationRule {
  /**
   * Αν `true`, residential type όπου αναμένεται τουλάχιστον 1 orientation.
   * Studio / loft / apartment_1br: `false` (μικρές μονάδες, μερικές
   * εσωτερικές χωρίς εξωτερικό προσανατολισμό).
   */
  readonly orientationExpected: boolean;
  /**
   * Maximum typical orientations για τον τύπο. Πάνω από αυτό → `unusual`.
   * Standalone (villa/detached_house) → 8 (όλες οι κατευθύνσεις θεμιτές).
   * Commercial (shop/office) → 2 (πρόσοψη + γωνία max). `null` = no cap.
   */
  readonly typicalMax: number | null;
  /**
   * Αν `true`, ο τύπος είναι standalone (villa/detached_house) — όλες οι 8
   * κατευθύνσεις είναι λογικές. Skip το `tooMany` check.
   */
  readonly isStandalone: boolean;
  /**
   * Αν `true`, ο τύπος είναι commercial (shop/office/hall). Αυστηρότερο
   * όριο `typicalMax` (συνήθως 1-2 προσόψεις).
   */
  readonly isCommercial: boolean;
}

/**
 * Google-style business rules per property type. Tuned στην ελληνική αγορά:
 *   - Standalone (villa, detached_house) → no cap (όλες οι κατευθύνσεις θεμιτές)
 *   - Apartment / maisonette / penthouse → 4 max (corner unit ή diagonal)
 *   - Studio / loft / apartment_1br → 4 max αλλά no expectation
 *   - Shop / office → 2 max (façade + corner)
 *   - Hall / storage → no orientation expectation (auxiliary)
 */
export const ORIENTATION_RULES: Readonly<
  Record<PropertyTypeCanonical, OrientationRule>
> = {
  studio: {
    orientationExpected: false,
    typicalMax: 4,
    isStandalone: false,
    isCommercial: false,
  },
  apartment_1br: {
    orientationExpected: false,
    typicalMax: 4,
    isStandalone: false,
    isCommercial: false,
  },
  apartment: {
    orientationExpected: true,
    typicalMax: 4,
    isStandalone: false,
    isCommercial: false,
  },
  maisonette: {
    orientationExpected: true,
    typicalMax: 4,
    isStandalone: false,
    isCommercial: false,
  },
  penthouse: {
    orientationExpected: true,
    typicalMax: 4,
    isStandalone: false,
    isCommercial: false,
  },
  loft: {
    orientationExpected: false,
    typicalMax: 4,
    isStandalone: false,
    isCommercial: false,
  },
  detached_house: {
    orientationExpected: true,
    typicalMax: null,
    isStandalone: true,
    isCommercial: false,
  },
  villa: {
    orientationExpected: true,
    typicalMax: null,
    isStandalone: true,
    isCommercial: false,
  },
  shop: {
    orientationExpected: false,
    typicalMax: 2,
    isStandalone: false,
    isCommercial: true,
  },
  office: {
    orientationExpected: false,
    typicalMax: 2,
    isStandalone: false,
    isCommercial: true,
  },
  hall: {
    orientationExpected: false,
    typicalMax: null,
    isStandalone: false,
    isCommercial: true,
  },
  storage: {
    orientationExpected: false,
    typicalMax: null,
    isStandalone: false,
    isCommercial: false,
  },
};

// =============================================================================
// 2. ASSESSMENT — public API
// =============================================================================

export type OrientationVerdict =
  | 'ok'
  | 'unusual'
  | 'implausible'
  | 'insufficientData';

export type OrientationReason =
  | 'missingResidential'
  | 'tooMany'
  | 'allEightNonStandalone'
  | 'commercialAllDirections'
  | null;

export interface OrientationAssessment {
  readonly verdict: OrientationVerdict;
  readonly reason: OrientationReason;
  readonly propertyType: PropertyTypeCanonical | null;
  readonly count: number;
}

export interface AssessOrientationPlausibilityArgs {
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly orientations: readonly string[] | undefined | null;
}

/**
 * Assess whether the selected orientations are plausible for the given type.
 *
 * **Gate order**:
 *   1. `propertyType` must be known → otherwise `insufficientData`.
 *   2. `commercialAllDirections` (commercial με > typicalMax) → `unusual`.
 *   3. `allEightNonStandalone` (8 in non-standalone) → `unusual`.
 *   4. `tooMany` (count > typicalMax in non-standalone non-commercial) → `unusual`.
 *   5. `missingResidential` (residential with 0) → `unusual`.
 *   6. Otherwise → `ok`.
 */
export function assessOrientationPlausibility(
  args: AssessOrientationPlausibilityArgs,
): OrientationAssessment {
  const { propertyType } = args;
  const orientations = Array.isArray(args.orientations) ? args.orientations : [];
  const count = orientations.length;

  if (!isKnownPropertyType(propertyType)) {
    return { verdict: 'insufficientData', reason: null, propertyType: null, count };
  }

  const rule = ORIENTATION_RULES[propertyType];

  // Step 2: commercial με υπερβολικά πολλούς προσανατολισμούς
  if (
    rule.isCommercial &&
    rule.typicalMax !== null &&
    count > rule.typicalMax
  ) {
    return { verdict: 'unusual', reason: 'commercialAllDirections', propertyType, count };
  }

  // Step 3: 8 προσανατολισμοί σε non-standalone (residential ή commercial)
  if (count === 8 && !rule.isStandalone) {
    return { verdict: 'unusual', reason: 'allEightNonStandalone', propertyType, count };
  }

  // Step 4: count > typicalMax σε non-standalone non-commercial residential
  if (
    !rule.isStandalone &&
    !rule.isCommercial &&
    rule.typicalMax !== null &&
    count > rule.typicalMax
  ) {
    return { verdict: 'unusual', reason: 'tooMany', propertyType, count };
  }

  // Step 5: residential που αναμένεται orientation αλλά είναι κενό
  if (rule.orientationExpected && count === 0) {
    return { verdict: 'unusual', reason: 'missingResidential', propertyType, count };
  }

  return { verdict: 'ok', reason: null, propertyType, count };
}

/**
 * Convenience: returns `true` αν το verdict χρειάζεται εμφάνιση ως warning.
 */
export function isActionableOrientationVerdict(
  verdict: OrientationVerdict,
): verdict is 'unusual' | 'implausible' {
  return verdict === 'unusual' || verdict === 'implausible';
}

// =============================================================================
// 3. INTERNAL HELPERS
// =============================================================================

const KNOWN_PROPERTY_TYPES: ReadonlySet<string> = new Set<PropertyTypeCanonical>([
  'studio',
  'apartment_1br',
  'apartment',
  'maisonette',
  'penthouse',
  'loft',
  'detached_house',
  'villa',
  'shop',
  'office',
  'hall',
  'storage',
]);

function isKnownPropertyType(
  value: unknown,
): value is PropertyTypeCanonical {
  return typeof value === 'string' && KNOWN_PROPERTY_TYPES.has(value);
}

// Re-export helper for component use (verifies standalone discriminator)
export { isStandaloneUnitType };
