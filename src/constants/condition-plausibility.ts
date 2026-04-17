/**
 * =============================================================================
 * SSoT: Condition Plausibility (Google-style cross-field sanity check)
 * =============================================================================
 *
 * **Single Source of Truth** για το "is the physical condition consistent
 * with operationalStatus, heatingType, and energyClass?" check. Εμφανίζεται
 * σαν inline non-blocking warning όταν ο χρήστης συνδυάζει τιμές που
 * αντιφάσκουν (π.χ. "νέο" χωρίς θέρμανση, "χρήζει ανακαίνισης" + "έτοιμο",
 * "νέο" + ενεργειακή κλάση F).
 *
 * **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save.
 * Ο χρήστης μπορεί να έχει legitimate reason (μη οριστικοποιημένα στοιχεία,
 * partial data entry). Warning = UX hint για να πιάσει αντιφάσεις.
 *
 * **Layering**: Leaf module — καμία εξάρτηση από άλλα domain modules.
 *
 * **Priority order** (most severe first, single-reason surfacing):
 *   1. `needsRenovationButReady` — contradicts operational status (implausible)
 *   2. `newWithoutHeating`       — KENAK code violation (implausible)
 *   3. `newButLowEnergy`         — new build με χαμηλή κλάση (unusual)
 *   4. `needsRenovationHighEnergy` — incoherent (unusual)
 *
 * @module constants/condition-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 24)
 */

// =============================================================================
// 1. SHARED TYPE DEFINITIONS (mirror property-features-enterprise)
// =============================================================================

const KNOWN_CONDITIONS = new Set(['new', 'excellent', 'good', 'needs-renovation']);
const KNOWN_OPERATIONAL_STATUSES = new Set(['ready', 'under-construction']);
const KNOWN_HEATING_NONE = 'none';
const HIGH_ENERGY_CLASSES = new Set(['A+', 'A', 'B']);
const LOW_ENERGY_CLASSES = new Set(['E', 'F', 'G']);

// =============================================================================
// 2. ASSESSMENT — public API
// =============================================================================

export type ConditionVerdict =
  | 'ok'
  | 'unusual'
  | 'implausible'
  | 'insufficientData';

export type ConditionReason =
  | 'newWithoutHeating'
  | 'needsRenovationButReady'
  | 'newButLowEnergy'
  | 'needsRenovationHighEnergy'
  | null;

export interface ConditionAssessment {
  readonly verdict: ConditionVerdict;
  readonly reason: ConditionReason;
  readonly condition: string | null;
  readonly operationalStatus: string | null;
  readonly heatingType: string | null;
  readonly energyClass: string | null;
}

export interface AssessConditionPlausibilityArgs {
  readonly condition: string | undefined | null;
  readonly operationalStatus: string | undefined | null;
  readonly heatingType: string | undefined | null;
  readonly energyClass: string | undefined | null;
}

/**
 * Assess whether the condition value is coherent with related fields.
 *
 * **Gate order**:
 *   1. `condition` must be known → otherwise `insufficientData`.
 *   2. `needsRenovationButReady` (implausible).
 *   3. `newWithoutHeating` (implausible — KENAK code).
 *   4. `newButLowEnergy` (unusual).
 *   5. `needsRenovationHighEnergy` (unusual).
 *   6. Otherwise → `ok`.
 */
export function assessConditionPlausibility(
  args: AssessConditionPlausibilityArgs,
): ConditionAssessment {
  const condition = normalize(args.condition);
  const operationalStatus = normalize(args.operationalStatus);
  const heatingType = normalize(args.heatingType);
  const energyClass = normalize(args.energyClass);

  if (!condition || !KNOWN_CONDITIONS.has(condition)) {
    return {
      verdict: 'insufficientData',
      reason: null,
      condition: null,
      operationalStatus,
      heatingType,
      energyClass,
    };
  }

  // Step 2: needs-renovation + ready = contradiction
  if (
    condition === 'needs-renovation' &&
    operationalStatus === 'ready' &&
    KNOWN_OPERATIONAL_STATUSES.has(operationalStatus)
  ) {
    return buildAssessment(
      'implausible',
      'needsRenovationButReady',
      condition,
      operationalStatus,
      heatingType,
      energyClass,
    );
  }

  // Step 3: condition=new + heating=none → KENAK code violation
  if (
    condition === 'new' &&
    heatingType === KNOWN_HEATING_NONE
  ) {
    return buildAssessment(
      'implausible',
      'newWithoutHeating',
      condition,
      operationalStatus,
      heatingType,
      energyClass,
    );
  }

  // Step 4: condition=new με low energy class
  if (
    condition === 'new' &&
    energyClass &&
    LOW_ENERGY_CLASSES.has(energyClass)
  ) {
    return buildAssessment(
      'unusual',
      'newButLowEnergy',
      condition,
      operationalStatus,
      heatingType,
      energyClass,
    );
  }

  // Step 5: needs-renovation με high energy class
  if (
    condition === 'needs-renovation' &&
    energyClass &&
    HIGH_ENERGY_CLASSES.has(energyClass)
  ) {
    return buildAssessment(
      'unusual',
      'needsRenovationHighEnergy',
      condition,
      operationalStatus,
      heatingType,
      energyClass,
    );
  }

  return buildAssessment('ok', null, condition, operationalStatus, heatingType, energyClass);
}

export function isActionableConditionVerdict(
  verdict: ConditionVerdict,
): verdict is 'unusual' | 'implausible' {
  return verdict === 'unusual' || verdict === 'implausible';
}

// =============================================================================
// 3. INTERNAL HELPERS
// =============================================================================

function buildAssessment(
  verdict: ConditionVerdict,
  reason: ConditionReason,
  condition: string,
  operationalStatus: string | null,
  heatingType: string | null,
  energyClass: string | null,
): ConditionAssessment {
  return { verdict, reason, condition, operationalStatus, heatingType, energyClass };
}

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
