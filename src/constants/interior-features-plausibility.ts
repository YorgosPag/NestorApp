/**
 * =============================================================================
 * SSoT: Interior Features Plausibility
 * =============================================================================
 *
 * **Single Source of Truth** για το "are interior features coherent with
 * energy class, type, area, and other systems?" check. Εμφανίζεται σαν
 * inline non-blocking warning όταν ο χρήστης συνδυάζει features που
 * αντιφάσκουν (φωτοβολταϊκά + κλάση F), είναι σπάνια για τον τύπο (τζάκι σε
 * studio 25 τ.μ.), ή είναι διπλές καταχωρήσεις (κλιματιστικό feature +
 * coolingType set).
 *
 * **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save.
 *
 * **Layering**: Leaf module — εξαρτάται μόνο από `property-types.ts`.
 *
 * **Priority order** (most severe first, single-reason surfacing):
 *   1. `airConditioningRedundant`  — duplicate field (unusual)
 *   2. `underfloorHeatingNoCentral` — incoherent (unusual)
 *   3. `solarPanelsLowEnergy`      — incoherent (unusual)
 *   4. `fireplaceTinyStudio`       — physical fit (unusual)
 *   5. `luxuryFeaturesStudio`      — type mismatch (unusual)
 *
 * @module constants/interior-features-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 24)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. SHARED CONSTANTS
// =============================================================================

const FEATURE_FIREPLACE = 'fireplace';
const FEATURE_JACUZZI = 'jacuzzi';
const FEATURE_SAUNA = 'sauna';
const FEATURE_SOLAR_PANELS = 'solar-panels';
const FEATURE_UNDERFLOOR_HEATING = 'underfloor-heating';
const FEATURE_AIR_CONDITIONING = 'air-conditioning';
const HEATING_NONE = 'none';
const HEATING_AUTONOMOUS = 'autonomous'; // not central — carries fireplace/heat-pump alt
const COOLING_NONE = 'none';

const LOW_ENERGY_CLASSES = new Set(['F', 'G']);

const TINY_STUDIO_THRESHOLD_M2 = 35;

const STUDIO_TYPES: ReadonlySet<PropertyTypeCanonical> = new Set<PropertyTypeCanonical>([
  'studio',
  'apartment_1br',
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

export type InteriorFeaturesVerdict =
  | 'ok'
  | 'unusual'
  | 'implausible'
  | 'insufficientData';

export type InteriorFeaturesReason =
  | 'solarPanelsLowEnergy'
  | 'fireplaceTinyStudio'
  | 'airConditioningRedundant'
  | 'luxuryFeaturesStudio'
  | 'underfloorHeatingNoCentral'
  | null;

export interface InteriorFeaturesAssessment {
  readonly verdict: InteriorFeaturesVerdict;
  readonly reason: InteriorFeaturesReason;
  readonly propertyType: PropertyTypeCanonical | null;
  readonly interiorFeatures: readonly string[];
  readonly securityFeatures: readonly string[];
  readonly energyClass: string | null;
  readonly heatingType: string | null;
  readonly coolingType: string | null;
  readonly areaGross: number | null;
  /** Used για luxuryFeaturesStudio reason (joined list για i18n placeholder). */
  readonly luxuryFeatureList: readonly string[];
}

export interface AssessInteriorFeaturesPlausibilityArgs {
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly interiorFeatures: readonly string[] | undefined | null;
  readonly securityFeatures: readonly string[] | undefined | null;
  readonly energyClass: string | undefined | null;
  readonly heatingType: string | undefined | null;
  readonly coolingType: string | undefined | null;
  readonly areaGross: number | string | undefined | null;
}

/**
 * Assess whether interior features are coherent with related fields.
 *
 * **Gate order**:
 *   1. `interiorFeatures` not empty → otherwise `insufficientData`.
 *   2. `airConditioningRedundant` (unusual).
 *   3. `underfloorHeatingNoCentral` (unusual).
 *   4. `solarPanelsLowEnergy` (unusual).
 *   5. `fireplaceTinyStudio` (unusual) — needs propertyType + areaGross.
 *   6. `luxuryFeaturesStudio` (unusual) — needs propertyType.
 *   7. Otherwise → `ok`.
 */
export function assessInteriorFeaturesPlausibility(
  args: AssessInteriorFeaturesPlausibilityArgs,
): InteriorFeaturesAssessment {
  const { propertyType: propertyTypeRaw } = args;
  const interiorFeatures = Array.isArray(args.interiorFeatures)
    ? args.interiorFeatures.filter(Boolean)
    : [];
  const securityFeatures = Array.isArray(args.securityFeatures)
    ? args.securityFeatures.filter(Boolean)
    : [];
  const energyClass = normalize(args.energyClass);
  const heatingType = normalize(args.heatingType);
  const coolingType = normalize(args.coolingType);
  const areaGross = toNonNegativeNumber(args.areaGross);
  const propertyType = isKnownPropertyType(propertyTypeRaw) ? propertyTypeRaw : null;

  if (interiorFeatures.length === 0) {
    return {
      verdict: 'insufficientData',
      reason: null,
      propertyType,
      interiorFeatures,
      securityFeatures,
      energyClass,
      heatingType,
      coolingType,
      areaGross,
      luxuryFeatureList: [],
    };
  }

  // Step 2: air-conditioning feature + coolingType set (≠ none) → duplicate
  if (
    interiorFeatures.includes(FEATURE_AIR_CONDITIONING) &&
    coolingType !== null &&
    coolingType !== COOLING_NONE
  ) {
    return build('unusual', 'airConditioningRedundant', interiorFeatures, securityFeatures, propertyType, energyClass, heatingType, coolingType, areaGross, []);
  }

  // Step 3: underfloor-heating + heatingType=none → contradictory
  if (
    interiorFeatures.includes(FEATURE_UNDERFLOOR_HEATING) &&
    (heatingType === HEATING_NONE || heatingType === HEATING_AUTONOMOUS)
  ) {
    return build('unusual', 'underfloorHeatingNoCentral', interiorFeatures, securityFeatures, propertyType, energyClass, heatingType, coolingType, areaGross, []);
  }

  // Step 5: solar-panels + low energy class → incoherent
  if (
    interiorFeatures.includes(FEATURE_SOLAR_PANELS) &&
    energyClass &&
    LOW_ENERGY_CLASSES.has(energyClass)
  ) {
    return build('unusual', 'solarPanelsLowEnergy', interiorFeatures, securityFeatures, propertyType, energyClass, heatingType, coolingType, areaGross, []);
  }

  // Step 6: fireplace σε tiny studio
  if (
    interiorFeatures.includes(FEATURE_FIREPLACE) &&
    propertyType !== null &&
    STUDIO_TYPES.has(propertyType) &&
    areaGross !== null &&
    areaGross > 0 &&
    areaGross < TINY_STUDIO_THRESHOLD_M2
  ) {
    return build('unusual', 'fireplaceTinyStudio', interiorFeatures, securityFeatures, propertyType, energyClass, heatingType, coolingType, areaGross, []);
  }

  // Step 7: jacuzzi/sauna σε studio (any size)
  if (propertyType !== null && STUDIO_TYPES.has(propertyType)) {
    const luxuryHits = interiorFeatures.filter(
      (f) => f === FEATURE_JACUZZI || f === FEATURE_SAUNA,
    );
    if (luxuryHits.length > 0) {
      return build('unusual', 'luxuryFeaturesStudio', interiorFeatures, securityFeatures, propertyType, energyClass, heatingType, coolingType, areaGross, luxuryHits);
    }
  }

  return build('ok', null, interiorFeatures, securityFeatures, propertyType, energyClass, heatingType, coolingType, areaGross, []);
}

export function isActionableInteriorFeaturesVerdict(
  verdict: InteriorFeaturesVerdict,
): verdict is 'unusual' | 'implausible' {
  return verdict === 'unusual' || verdict === 'implausible';
}

// =============================================================================
// 3. INTERNAL HELPERS
// =============================================================================

function build(
  verdict: InteriorFeaturesVerdict,
  reason: InteriorFeaturesReason,
  interiorFeatures: readonly string[],
  securityFeatures: readonly string[],
  propertyType: PropertyTypeCanonical | null,
  energyClass: string | null,
  heatingType: string | null,
  coolingType: string | null,
  areaGross: number | null,
  luxuryFeatureList: readonly string[],
): InteriorFeaturesAssessment {
  return {
    verdict,
    reason,
    propertyType,
    interiorFeatures,
    securityFeatures,
    energyClass,
    heatingType,
    coolingType,
    areaGross,
    luxuryFeatureList,
  };
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
