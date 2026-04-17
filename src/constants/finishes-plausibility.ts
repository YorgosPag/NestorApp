/**
 * =============================================================================
 * SSoT: Finishes (flooring + frames + glazing) Plausibility
 * =============================================================================
 *
 * **Single Source of Truth** για το "are finishes coherent with energy class
 * and interior features?" check. Εμφανίζεται σαν inline non-blocking warning
 * όταν ο χρήστης συνδυάζει τιμές που αντιφάσκουν φυσικά (μονό τζάμι +
 * ενεργειακή Α), ή είναι αντιπαραγωγικές (μοκέτα + ενδοδαπέδια θέρμανση), ή
 * αφήνει finishes κενά σε finished unit.
 *
 * **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save.
 * Ο χρήστης μπορεί να έχει legitimate reason. Warning = UX hint.
 *
 * **Layering**: Leaf module — εξαρτάται μόνο από `property-types.ts` (κοινό
 * canonical typeset για residential gating).
 *
 * **Priority order** (most severe first, single-reason surfacing):
 *   1. `glazingSingleHighEnergy`      — physically impossible (implausible)
 *   2. `carpetWithUnderfloor`         — counterproductive (unusual)
 *   3. `glazingTripleLowEnergy`       — incoherent investment (unusual)
 *   4. `glazingMissingResidential`    — κενό glazing σε residential (unusual)
 *   5. `flooringMissingResidential`   — κενό flooring σε residential (unusual)
 *   6. `framesMissingResidential`     — κενό frames σε residential (unusual)
 *
 * Διάκριση `''` (κενό — "δεν απαντήθηκε") vs `'none'` (ρητή απουσία):
 * τα *MissingResidential rules πυροδοτούνται μόνο όταν η τιμή είναι κενή (null
 * μετά το normalize). Residential gating αντικαθιστά το παλιό `FINISHED_CONDITIONS`
 * gate (Batch 25): κάθε κατοικία έχει κατά κανόνα δάπεδα + κουφώματα + υαλοπίνακες,
 * άρα missing πρέπει να προειδοποιεί ανεξαρτήτως condition.
 *
 * @module constants/finishes-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 25)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. SHARED CONSTANTS
// =============================================================================

const HIGH_ENERGY_CLASSES = new Set(['A+', 'A', 'B']);
const LOW_ENERGY_CLASSES = new Set(['F', 'G']);

const GLAZING_SINGLE = 'single';
const GLAZING_TRIPLE = 'triple';
const FLOORING_CARPET = 'carpet';
const INTERIOR_UNDERFLOOR = 'underfloor-heating';

/**
 * Residential type-set που υπόκειται σε missing-finishes warnings.
 * Mirror του set στο `systems-plausibility.ts` — intentional duplication
 * ανάμεσα σε leaf modules για zero cross-module coupling.
 */
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

// =============================================================================
// 2. ASSESSMENT — public API
// =============================================================================

export type FinishesVerdict =
  | 'ok'
  | 'unusual'
  | 'implausible'
  | 'insufficientData';

export type FinishesReason =
  | 'glazingSingleHighEnergy'
  | 'glazingTripleLowEnergy'
  | 'carpetWithUnderfloor'
  | 'glazingMissingResidential'
  | 'flooringMissingResidential'
  | 'framesMissingResidential'
  | null;

export interface FinishesAssessment {
  readonly verdict: FinishesVerdict;
  readonly reason: FinishesReason;
  readonly propertyType: PropertyTypeCanonical | string | null;
  readonly flooring: readonly string[];
  readonly windowFrames: string | null;
  readonly glazing: string | null;
  readonly energyClass: string | null;
  readonly condition: string | null;
}

export interface AssessFinishesPlausibilityArgs {
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly flooring: readonly string[] | undefined | null;
  readonly windowFrames: string | undefined | null;
  readonly glazing: string | undefined | null;
  readonly energyClass: string | undefined | null;
  readonly condition: string | undefined | null;
  readonly interiorFeatures: readonly string[] | undefined | null;
}

/**
 * Assess whether finishes are coherent with energy/condition/features/type.
 *
 * **Gate order**:
 *   1. `glazingSingleHighEnergy` (implausible) — physically incompatible.
 *   2. `carpetWithUnderfloor` (unusual) — counterproductive.
 *   3. `glazingTripleLowEnergy` (unusual) — incoherent investment.
 *   4. `glazingMissingResidential` (unusual) — missing glazing σε residential.
 *   5. `flooringMissingResidential` (unusual) — missing flooring σε residential.
 *   6. `framesMissingResidential` (unusual) — missing frames σε residential.
 *   7. Otherwise → `ok`.
 *
 * Returns `insufficientData` σε περίπτωση που ΟΛΑ τα fields είναι κενά.
 */
export function assessFinishesPlausibility(
  args: AssessFinishesPlausibilityArgs,
): FinishesAssessment {
  const propertyType = normalize(args.propertyType);
  const flooring = Array.isArray(args.flooring) ? args.flooring.filter(Boolean) : [];
  const windowFrames = normalize(args.windowFrames);
  const glazing = normalize(args.glazing);
  const energyClass = normalize(args.energyClass);
  const condition = normalize(args.condition);
  const interiorFeatures = Array.isArray(args.interiorFeatures)
    ? args.interiorFeatures.filter(Boolean)
    : [];

  const allEmpty =
    flooring.length === 0 &&
    windowFrames === null &&
    glazing === null &&
    energyClass === null &&
    condition === null;

  if (allEmpty) {
    return {
      verdict: 'insufficientData',
      reason: null,
      propertyType,
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    };
  }

  const isResidential =
    propertyType !== null && RESIDENTIAL_TYPES.has(propertyType as PropertyTypeCanonical);

  // Step 1: glazing=single + high energy class → physically incompatible
  if (
    glazing === GLAZING_SINGLE &&
    energyClass &&
    HIGH_ENERGY_CLASSES.has(energyClass)
  ) {
    return buildAssessment(
      'implausible',
      'glazingSingleHighEnergy',
      propertyType,
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  // Step 2: flooring=carpet + interior underfloor-heating → counterproductive
  if (
    flooring.includes(FLOORING_CARPET) &&
    interiorFeatures.includes(INTERIOR_UNDERFLOOR)
  ) {
    return buildAssessment(
      'unusual',
      'carpetWithUnderfloor',
      propertyType,
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  // Step 3: glazing=triple + low energy class → over-investment
  if (
    glazing === GLAZING_TRIPLE &&
    energyClass &&
    LOW_ENERGY_CLASSES.has(energyClass)
  ) {
    return buildAssessment(
      'unusual',
      'glazingTripleLowEnergy',
      propertyType,
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  // Step 4: residential χωρίς καταχωρημένους υαλοπίνακες
  if (glazing === null && isResidential) {
    return buildAssessment(
      'unusual',
      'glazingMissingResidential',
      propertyType,
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  // Step 5: residential χωρίς καταχωρημένο δάπεδο
  if (flooring.length === 0 && isResidential) {
    return buildAssessment(
      'unusual',
      'flooringMissingResidential',
      propertyType,
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  // Step 6: residential χωρίς καταχωρημένα κουφώματα
  if (windowFrames === null && isResidential) {
    return buildAssessment(
      'unusual',
      'framesMissingResidential',
      propertyType,
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  return buildAssessment(
    'ok',
    null,
    propertyType,
    flooring,
    windowFrames,
    glazing,
    energyClass,
    condition,
  );
}

export function isActionableFinishesVerdict(
  verdict: FinishesVerdict,
): verdict is 'unusual' | 'implausible' {
  return verdict === 'unusual' || verdict === 'implausible';
}

// =============================================================================
// 3. INTERNAL HELPERS
// =============================================================================

function buildAssessment(
  verdict: FinishesVerdict,
  reason: FinishesReason,
  propertyType: string | null,
  flooring: readonly string[],
  windowFrames: string | null,
  glazing: string | null,
  energyClass: string | null,
  condition: string | null,
): FinishesAssessment {
  return {
    verdict,
    reason,
    propertyType,
    flooring,
    windowFrames,
    glazing,
    energyClass,
    condition,
  };
}

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
