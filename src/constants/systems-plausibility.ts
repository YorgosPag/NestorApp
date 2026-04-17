/**
 * =============================================================================
 * SSoT: Heating + Cooling Systems Plausibility (Google-style sanity check)
 * =============================================================================
 *
 * **Single Source of Truth** για το "are heating and cooling systems
 * consistent with property type, area, and condition?" check. Εμφανίζεται
 * σαν inline non-blocking warning όταν ο χρήστης συνδυάζει τιμές που
 * αντιφάσκουν με ελληνικό κλίμα + ΚΕνΑΚ (π.χ. residential χωρίς θέρμανση,
 * central air σε στούντιο 25 τ.μ., νέα κατασκευή με heating=none).
 *
 * **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save.
 * Ο χρήστης μπορεί να έχει legitimate reason (raw shell, tropical climate
 * exception, partial data). Warning = UX hint.
 *
 * **Layering**: Leaf module — εξαρτάται μόνο από `property-types.ts`.
 *
 * **Priority order** (most severe first, single-reason surfacing):
 *   1. `heatingNoneNewBuild`       — condition=new + heating=none (implausible)
 *   2. `heatingNoneResidential`    — residential με heating=none (implausible)
 *   3. `coolingOversizedTinyUnit`  — central-air σε <40 τ.μ. (unusual)
 *   4. `coolingNoneLargeUnit`      — residential >120 τ.μ. χωρίς ψύξη (unusual)
 *
 * @module constants/systems-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 24)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. SHARED CONSTANTS
// =============================================================================

const HEATING_NONE = 'none';
const COOLING_NONE = 'none';
const COOLING_CENTRAL_AIR = 'central-air';
const CONDITION_NEW = 'new';

/**
 * Type-set που υπόκειται σε ΚΕνΑΚ heating requirement.
 * Standalone + apartment family + commercial residential-like.
 * Storage / hall = exempt (auxiliary / open-plan).
 */
const HEATING_REQUIRED_TYPES: ReadonlySet<PropertyTypeCanonical> = new Set<PropertyTypeCanonical>([
  'studio',
  'apartment_1br',
  'apartment',
  'maisonette',
  'penthouse',
  'loft',
  'detached_house',
  'villa',
  'office',
]);

/**
 * Όριο σε τ.μ. κάτω από το οποίο central-air θεωρείται oversized.
 */
const COOLING_OVERSIZED_THRESHOLD_M2 = 40;

/**
 * Όριο σε τ.μ. πάνω από το οποίο residential χωρίς ψύξη είναι ασυνήθιστο.
 */
const COOLING_NONE_LARGE_THRESHOLD_M2 = 120;

const RESIDENTIAL_TYPES: ReadonlySet<PropertyTypeCanonical> = new Set<PropertyTypeCanonical>([
  'studio',
  'apartment_1br',
  'apartment',
  'maisonette',
  'penthouse',
  'loft',
  'detached_house',
  'villa',
]);

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

// =============================================================================
// 2. ASSESSMENT — public API
// =============================================================================

export type SystemsVerdict =
  | 'ok'
  | 'unusual'
  | 'implausible'
  | 'insufficientData';

export type SystemsReason =
  | 'heatingNoneResidential'
  | 'heatingNoneNewBuild'
  | 'coolingOversizedTinyUnit'
  | 'coolingNoneLargeUnit'
  | null;

export interface SystemsAssessment {
  readonly verdict: SystemsVerdict;
  readonly reason: SystemsReason;
  readonly propertyType: PropertyTypeCanonical | null;
  readonly heatingType: string | null;
  readonly coolingType: string | null;
  readonly condition: string | null;
  readonly areaGross: number | null;
}

export interface AssessSystemsPlausibilityArgs {
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly heatingType: string | undefined | null;
  readonly coolingType: string | undefined | null;
  readonly condition: string | undefined | null;
  readonly areaGross: number | string | undefined | null;
}

/**
 * Assess whether heating + cooling systems are coherent.
 *
 * **Gate order**:
 *   1. `propertyType` known → otherwise `insufficientData`.
 *   2. `heatingNoneNewBuild` (implausible).
 *   3. `heatingNoneResidential` (implausible).
 *   4. `coolingOversizedTinyUnit` (unusual).
 *   5. `coolingNoneLargeUnit` (unusual).
 *   6. Otherwise → `ok`.
 */
export function assessSystemsPlausibility(
  args: AssessSystemsPlausibilityArgs,
): SystemsAssessment {
  const { propertyType } = args;
  const heatingType = normalize(args.heatingType);
  const coolingType = normalize(args.coolingType);
  const condition = normalize(args.condition);
  const areaGross = toNonNegativeNumber(args.areaGross);

  if (!isKnownPropertyType(propertyType)) {
    return {
      verdict: 'insufficientData',
      reason: null,
      propertyType: null,
      heatingType,
      coolingType,
      condition,
      areaGross,
    };
  }

  // Step 2: condition=new + heating=none → ΚΕνΑΚ violation (most specific)
  if (
    heatingType === HEATING_NONE &&
    condition === CONDITION_NEW
  ) {
    return buildAssessment(
      'implausible',
      'heatingNoneNewBuild',
      propertyType,
      heatingType,
      coolingType,
      condition,
      areaGross,
    );
  }

  // Step 3: residential με heating=none → ΚΕνΑΚ violation
  if (
    heatingType === HEATING_NONE &&
    HEATING_REQUIRED_TYPES.has(propertyType)
  ) {
    return buildAssessment(
      'implausible',
      'heatingNoneResidential',
      propertyType,
      heatingType,
      coolingType,
      condition,
      areaGross,
    );
  }

  // Step 4: central-air σε πολύ μικρή μονάδα
  if (
    coolingType === COOLING_CENTRAL_AIR &&
    areaGross !== null &&
    areaGross > 0 &&
    areaGross < COOLING_OVERSIZED_THRESHOLD_M2 &&
    RESIDENTIAL_TYPES.has(propertyType)
  ) {
    return buildAssessment(
      'unusual',
      'coolingOversizedTinyUnit',
      propertyType,
      heatingType,
      coolingType,
      condition,
      areaGross,
    );
  }

  // Step 5: residential μεγάλη μονάδα χωρίς ψύξη
  if (
    coolingType === COOLING_NONE &&
    areaGross !== null &&
    areaGross > COOLING_NONE_LARGE_THRESHOLD_M2 &&
    RESIDENTIAL_TYPES.has(propertyType)
  ) {
    return buildAssessment(
      'unusual',
      'coolingNoneLargeUnit',
      propertyType,
      heatingType,
      coolingType,
      condition,
      areaGross,
    );
  }

  return buildAssessment('ok', null, propertyType, heatingType, coolingType, condition, areaGross);
}

export function isActionableSystemsVerdict(
  verdict: SystemsVerdict,
): verdict is 'unusual' | 'implausible' {
  return verdict === 'unusual' || verdict === 'implausible';
}

// =============================================================================
// 3. INTERNAL HELPERS
// =============================================================================

function buildAssessment(
  verdict: SystemsVerdict,
  reason: SystemsReason,
  propertyType: PropertyTypeCanonical,
  heatingType: string | null,
  coolingType: string | null,
  condition: string | null,
  areaGross: number | null,
): SystemsAssessment {
  return { verdict, reason, propertyType, heatingType, coolingType, condition, areaGross };
}

function isKnownPropertyType(value: unknown): value is PropertyTypeCanonical {
  return typeof value === 'string' && KNOWN_PROPERTY_TYPES.has(value);
}

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }
  return null;
}
