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
 * **Layering**: Leaf module — εξαρτάται μόνο από `property-types.ts` (κοινό
 * canonical typeset για residential gating).
 *
 * **Priority order** (most severe first, single-reason surfacing):
 *   1. `needsRenovationButReady`        — contradicts operational status (implausible)
 *   2. `newWithoutHeating`              — KENAK code violation (implausible)
 *   3. `conditionMissingResidential`    — residential χωρίς καταχωρημένη condition (unusual)
 *   4. `newButLowEnergy`                — new build με χαμηλή κλάση (unusual)
 *   5. `needsRenovationHighEnergy`      — incoherent (unusual)
 *   6. `energyClassMissingResidential`  — residential χωρίς καταχωρημένη κλάση (unusual)
 *
 * **Pre-completion gating (Batch 27)**: Όταν το `operationalStatus` είναι
 * `draft` ή `under-construction`, οι "missing data" reasons
 * (`conditionMissingResidential`, `energyClassMissingResidential`)
 * καταπνίγονται — legitimate absence σε construction/entry phase. Cross-field
 * declarative reasons (newWithoutHeating, needsRenovationButReady,
 * newButLowEnergy, needsRenovationHighEnergy) παραμένουν active.
 *
 * @module constants/condition-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 27, extends Batch 25)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';
import { normalizePropertyType } from '@/constants/property-type-aliases';
import { isPreCompletionOperationalStatus } from '@/constants/operational-statuses';

// =============================================================================
// 1. SHARED TYPE DEFINITIONS (mirror property-features-enterprise)
// =============================================================================

const KNOWN_CONDITIONS = new Set(['new', 'excellent', 'good', 'needs-renovation']);
const KNOWN_OPERATIONAL_STATUSES = new Set(['ready', 'under-construction']);
const KNOWN_HEATING_NONE = 'none';
const HIGH_ENERGY_CLASSES = new Set(['A+', 'A', 'B']);
const LOW_ENERGY_CLASSES = new Set(['E', 'F', 'G']);

/**
 * Residential type-set για missing-condition / missing-energyClass gating.
 * Mirror του set σε `systems-plausibility.ts` + `finishes-plausibility.ts` —
 * intentional duplication ανάμεσα σε leaf modules για zero cross-module
 * coupling.
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
  | 'conditionMissingResidential'
  | 'energyClassMissingResidential'
  | null;

export interface ConditionAssessment {
  readonly verdict: ConditionVerdict;
  readonly reason: ConditionReason;
  /**
   * **Το είδος, στην κανονική του μορφή** — ή `null` όταν δεν αναγνωρίστηκε.
   *
   * 🔴 **ΗΤΑΝ `PropertyTypeCanonical | string | null`** — ένωση που **δεν λέει τίποτα**
   * (το `PropertyTypeCanonical` είναι ήδη `string`), και ακριβώς γι' αυτό η οθόνη που
   * τη διάβαζε αναγκαζόταν σε `as PropertyTypeCanonical` για να δεικτοδοτήσει τον
   * πίνακα ετικετών. Πλέον η αξιολόγηση **κανονικοποιεί** την είσοδο (ADR-842 §7.6.12 /
   * §8 #11) και ο καταναλωτής παίρνει τιμή που **μπορεί** να χρησιμοποιήσει.
   */
  readonly propertyType: PropertyTypeCanonical | null;
  readonly condition: string | null;
  readonly operationalStatus: string | null;
  readonly heatingType: string | null;
  readonly energyClass: string | null;
}

export interface AssessConditionPlausibilityArgs {
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly condition: string | undefined | null;
  readonly operationalStatus: string | undefined | null;
  readonly heatingType: string | undefined | null;
  readonly energyClass: string | undefined | null;
}

/**
 * Assess whether the condition value is coherent with related fields.
 *
 * **Gate order**:
 *   1. `needsRenovationButReady` (implausible) — condition set + operationalStatus=ready.
 *   2. `newWithoutHeating` (implausible) — condition set + heating=none.
 *   3. `conditionMissingResidential` (unusual) — residential χωρίς valid condition
 *      + NOT pre-completion.
 *   4. `newButLowEnergy` (unusual).
 *   5. `needsRenovationHighEnergy` (unusual).
 *   6. `energyClassMissingResidential` (unusual) — residential χωρίς καταχωρημένη κλάση
 *      + NOT pre-completion.
 *   7. Otherwise → `ok`.
 *
 * Returns `insufficientData` μόνο όταν δεν είναι residential ΚΑΙ το condition
 * είναι ελλιπές — δηλαδή δεν έχουμε τίποτα να ζυγίσουμε. Residential πάντα
 * αξιολογείται (missing → unusual warning, όχι silent).
 */
export function assessConditionPlausibility(
  args: AssessConditionPlausibilityArgs,
): ConditionAssessment {
  // 🔴 **Ο ΔΥΝΑΤΟΣ ΚΡΙΤΗΣ, ΟΧΙ ΣΚΕΤΟ trim** (ADR-842 §7.6.12): ο τοπικός `normalize`
  //    απαντά *«είναι μη κενή συμβολοσειρά;»* — για το **είδος** η ερώτηση είναι *«ποιο
  //    είδος είναι, ό,τι κι αν μου έγραψαν;»*. Με το παλιό, ένα `'Στούντιο'` περνούσε
  //    αυτούσιο και ο έλεγχος «είναι κατοικία;» απαντούσε **όχι** — δηλαδή η οθόνη δεν
  //    προειδοποιούσε ποτέ για ένα διαμέρισμα με παλαιά τιμή.
  const propertyType = normalizePropertyType(args.propertyType);
  const condition = normalize(args.condition);
  const operationalStatus = normalize(args.operationalStatus);
  const heatingType = normalize(args.heatingType);
  const energyClass = normalize(args.energyClass);

  const isResidential =
    propertyType !== null && RESIDENTIAL_TYPES.has(propertyType);
  const hasValidCondition = condition !== null && KNOWN_CONDITIONS.has(condition);
  // Pre-completion (draft / under-construction) → suppress "missing" warnings
  // (Google progressive disclosure). Declarative cross-field checks remain ON.
  const isPreCompletion = isPreCompletionOperationalStatus(operationalStatus);

  // Implausible cross-field rules (Step 1-2) — απαιτούν valid condition.
  if (hasValidCondition) {
    // Step 1: needs-renovation + ready = contradiction
    if (
      condition === 'needs-renovation' &&
      operationalStatus === 'ready' &&
      KNOWN_OPERATIONAL_STATUSES.has(operationalStatus)
    ) {
      return buildAssessment(
        'implausible',
        'needsRenovationButReady',
        propertyType,
        condition,
        operationalStatus,
        heatingType,
        energyClass,
      );
    }

    // Step 2: condition=new + heating=none → KENAK code violation
    if (condition === 'new' && heatingType === KNOWN_HEATING_NONE) {
      return buildAssessment(
        'implausible',
        'newWithoutHeating',
        propertyType,
        condition,
        operationalStatus,
        heatingType,
        energyClass,
      );
    }
  }

  // Step 3: residential χωρίς valid condition → unusual (missing data)
  // Suppressed σε pre-completion — condition = attribute of finished unit.
  if (!hasValidCondition) {
    if (isResidential && !isPreCompletion) {
      return buildAssessment(
        'unusual',
        'conditionMissingResidential',
        propertyType,
        null,
        operationalStatus,
        heatingType,
        energyClass,
      );
    }
    return {
      verdict: 'insufficientData',
      reason: null,
      propertyType,
      condition: null,
      operationalStatus,
      heatingType,
      energyClass,
    };
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
      propertyType,
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
      propertyType,
      condition,
      operationalStatus,
      heatingType,
      energyClass,
    );
  }

  // Step 6: residential χωρίς καταχωρημένη ενεργειακή κλάση → unusual
  // Suppressed σε pre-completion — ΠΕΑ εκδίδεται στην αποπεράτωση.
  if (energyClass === null && isResidential && !isPreCompletion) {
    return buildAssessment(
      'unusual',
      'energyClassMissingResidential',
      propertyType,
      condition,
      operationalStatus,
      heatingType,
      energyClass,
    );
  }

  return buildAssessment(
    'ok',
    null,
    propertyType,
    condition,
    operationalStatus,
    heatingType,
    energyClass,
  );
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
  propertyType: PropertyTypeCanonical | null,
  condition: string | null,
  operationalStatus: string | null,
  heatingType: string | null,
  energyClass: string | null,
): ConditionAssessment {
  return {
    verdict,
    reason,
    propertyType,
    condition,
    operationalStatus,
    heatingType,
    energyClass,
  };
}

function normalize(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
