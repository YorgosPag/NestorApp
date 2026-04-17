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
 * **Layering**: Leaf module — καμία εξάρτηση από άλλα domain modules.
 *
 * **Priority order** (most severe first, single-reason surfacing):
 *   1. `glazingSingleHighEnergy`   — physically impossible (implausible)
 *   2. `carpetWithUnderfloor`      — counterproductive (unusual)
 *   3. `glazingTripleLowEnergy`    — incoherent investment (unusual)
 *   4. `glazingMissingFinished`    — missing data on finished unit (unusual)
 *   5. `flooringEmptyFinished`     — missing data on finished unit (unusual)
 *
 * @module constants/finishes-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 24)
 */

// =============================================================================
// 1. SHARED CONSTANTS
// =============================================================================

const HIGH_ENERGY_CLASSES = new Set(['A+', 'A', 'B']);
const LOW_ENERGY_CLASSES = new Set(['F', 'G']);
const FINISHED_CONDITIONS = new Set(['new', 'excellent', 'good']);

const GLAZING_SINGLE = 'single';
const GLAZING_TRIPLE = 'triple';
const FLOORING_CARPET = 'carpet';
const INTERIOR_UNDERFLOOR = 'underfloor-heating';

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
  | 'flooringEmptyFinished'
  | 'glazingMissingFinished'
  | null;

export interface FinishesAssessment {
  readonly verdict: FinishesVerdict;
  readonly reason: FinishesReason;
  readonly flooring: readonly string[];
  readonly windowFrames: string | null;
  readonly glazing: string | null;
  readonly energyClass: string | null;
  readonly condition: string | null;
}

export interface AssessFinishesPlausibilityArgs {
  readonly flooring: readonly string[] | undefined | null;
  readonly windowFrames: string | undefined | null;
  readonly glazing: string | undefined | null;
  readonly energyClass: string | undefined | null;
  readonly condition: string | undefined | null;
  readonly interiorFeatures: readonly string[] | undefined | null;
}

/**
 * Assess whether finishes are coherent with energy/condition/features.
 *
 * **Gate order**:
 *   1. `glazingSingleHighEnergy` (implausible) — physically incompatible.
 *   2. `carpetWithUnderfloor` (unusual) — counterproductive.
 *   3. `glazingTripleLowEnergy` (unusual) — incoherent investment.
 *   4. `glazingMissingFinished` (unusual) — missing on finished unit.
 *   5. `flooringEmptyFinished` (unusual) — missing on finished unit.
 *   6. Otherwise → `ok`.
 *
 * Returns `insufficientData` σε περίπτωση που ΟΛΑ τα fields είναι κενά.
 */
export function assessFinishesPlausibility(
  args: AssessFinishesPlausibilityArgs,
): FinishesAssessment {
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
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    };
  }

  // Step 1: glazing=single + high energy class → physically incompatible
  if (
    glazing === GLAZING_SINGLE &&
    energyClass &&
    HIGH_ENERGY_CLASSES.has(energyClass)
  ) {
    return buildAssessment(
      'implausible',
      'glazingSingleHighEnergy',
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
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  // Step 4: glazing missing σε finished unit
  if (
    glazing === null &&
    condition &&
    FINISHED_CONDITIONS.has(condition)
  ) {
    return buildAssessment(
      'unusual',
      'glazingMissingFinished',
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  // Step 5: flooring empty σε finished unit
  if (
    flooring.length === 0 &&
    condition &&
    FINISHED_CONDITIONS.has(condition)
  ) {
    return buildAssessment(
      'unusual',
      'flooringEmptyFinished',
      flooring,
      windowFrames,
      glazing,
      energyClass,
      condition,
    );
  }

  return buildAssessment('ok', null, flooring, windowFrames, glazing, energyClass, condition);
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
  flooring: readonly string[],
  windowFrames: string | null,
  glazing: string | null,
  energyClass: string | null,
  condition: string | null,
): FinishesAssessment {
  return { verdict, reason, flooring, windowFrames, glazing, energyClass, condition };
}

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
