/**
 * =============================================================================
 * SSoT: Area (gross / net / balcony / terrace / garden) Plausibility
 * =============================================================================
 *
 * **Single Source of Truth** για το "are the area measurements plausible for
 * this property type?" check. Εμφανίζεται σαν inline non-blocking warning όταν
 * ο χρήστης εισάγει συνδυασμό εμβαδών που είναι φυσικά αδύνατος (net > gross),
 * ασύμβατος με τον ορισμό του τύπου (ρετιρέ χωρίς outdoor), ή εντελώς εκτός
 * τυπικών ορίων (στούντιο 500 τ.μ.).
 *
 * **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save.
 * Ο χρήστης μπορεί να έχει legitimate reason (raw/unfinished unit, loft με
 * γυμνά τούβλα, ακίνητο υπό έκδοση οικοδομικής άδειας). Warning = UX hint για
 * να πιάσει typos ή ασυνέπεια στα measurements.
 *
 * **Layering**: Leaf module — εξαρτάται μόνο από `property-types.ts`. Ασφαλές
 * για import παντού (server, client, tests).
 *
 * **Canonical field names** (match Firestore `areas.*` schema):
 *   - `gross`    — μεικτό εμβαδό (total built area, shared walls inclusive)
 *   - `net`      — καθαρό εμβαδό (usable interior surface)
 *   - `balcony`  — μπαλκόνι (open balcony)
 *   - `terrace`  — βεράντα / terrace (covered outdoor terrace)
 *   - `garden`   — κήπος (private garden, ground-level only)
 *
 * **Priority order** (most severe first, single-reason surfacing):
 *   1. `netExceedsGross`     — physically impossible (implausible)
 *   2. `netZeroWithGross`    — net=0 with gross>0 (implausible)
 *   3. `grossBelowMin`       — gross below physical minimum (implausible)
 *   4. `luxuryNoOutdoor`     — penthouse/villa/detached με 0 outdoor (implausible)
 *   5. `grossAboveMax`       — gross above typical max (unusual)
 *   6. `netRatioTooLow`      — net/gross < 0.60 (unusual)
 *   7. `netRatioTooHigh`     — net/gross > 0.95 (unusual)
 *   8. `netEqualsGross`      — net === gross exact (unusual)
 *   9. `noOutdoorResidential` — apt/maisonette με 0 outdoor (unusual)
 *  10. `gardenOnNonGround`    — garden > 0 σε apt/penthouse (unusual)
 *
 * **Greek real-estate typical ratios** (net/gross):
 *   - Well-built apartment: 0.82–0.92 (shared walls ~8–18% deduction)
 *   - Older construction:   0.75–0.88
 *   - Luxury villa:         0.85–0.93 (thinner shared walls, more usable)
 *
 * @module constants/area-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 21)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. PER-TYPE RULES
// =============================================================================

export interface AreaRule {
  /**
   * Minimum plausible gross area (τ.μ.). Κάτω από αυτό → `implausible` —
   * φυσικά αδύνατο να υπάρχει λειτουργική μονάδα αυτού του τύπου.
   * `null` = no lower bound check.
   */
  readonly grossHardMin: number | null;
  /**
   * Maximum typical gross area (τ.μ.). Πάνω από αυτό → `unusual` —
   * atypical αλλά πιθανό (luxury, commercial mega-space).
   * `null` = no upper bound check.
   */
  readonly grossTypicalMax: number | null;
  /**
   * Αν `true`, residential τύπος όπου αναμένεται τουλάχιστον ένα outdoor
   * element (balcony/terrace/garden). Κανένα outdoor → `unusual`.
   * Studio/loft/apartment_1br: `false` (tiny units legit χωρίς).
   */
  readonly outdoorExpected: boolean;
  /**
   * Αν `true`, luxury residential (penthouse/villa/detached_house) όπου η
   * απουσία κάθε outdoor είναι φυσικά ασύμβατη με τον ορισμό. Κανένα
   * outdoor → `implausible`.
   */
  readonly outdoorRequired: boolean;
  /**
   * Αν `true`, garden είναι τυπικό για τον τύπο (villa, detached_house,
   * ground-floor apartments). Αν `false` και garden > 0 → `unusual`
   * (π.χ. penthouse με κήπο — raro, probabile data entry error).
   */
  readonly gardenTypical: boolean;
  /**
   * Αν `true`, εφαρμόζεται ratio check (net/gross). Διαφορετικά (storage,
   * commercial hall open-plan) skip.
   */
  readonly ratioApplies: boolean;
}

/**
 * Google-style business rules per property type. Values tuned στην ελληνική
 * αγορά ακινήτων με reference Zillow/Idealista/Spitogatos standards.
 *
 * **Hard mins** = absolute floor, below which a unit of that type cannot
 * physically exist. **Typical maxes** = 95th percentile for market stock;
 * υπέρβαση σημαίνει ασυνήθιστα μεγάλο αλλά όχι αδύνατο.
 */
export const AREA_RULES: Readonly<Record<PropertyTypeCanonical, AreaRule>> = {
  studio: {
    grossHardMin: 10,
    grossTypicalMax: 65,
    outdoorExpected: false,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: true,
  },
  apartment_1br: {
    grossHardMin: 20,
    grossTypicalMax: 75,
    outdoorExpected: false,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: true,
  },
  apartment: {
    grossHardMin: 30,
    grossTypicalMax: 250,
    outdoorExpected: true,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: true,
  },
  maisonette: {
    grossHardMin: 50,
    grossTypicalMax: 400,
    outdoorExpected: true,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: true,
  },
  penthouse: {
    grossHardMin: 50,
    grossTypicalMax: 450,
    outdoorExpected: true,
    outdoorRequired: true,
    gardenTypical: false,
    ratioApplies: true,
  },
  loft: {
    grossHardMin: 25,
    grossTypicalMax: 300,
    outdoorExpected: false,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: true,
  },
  detached_house: {
    grossHardMin: 50,
    grossTypicalMax: 700,
    outdoorExpected: true,
    outdoorRequired: true,
    gardenTypical: true,
    ratioApplies: true,
  },
  villa: {
    grossHardMin: 80,
    grossTypicalMax: 1500,
    outdoorExpected: true,
    outdoorRequired: true,
    gardenTypical: true,
    ratioApplies: true,
  },
  shop: {
    grossHardMin: 8,
    grossTypicalMax: 800,
    outdoorExpected: false,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: true,
  },
  office: {
    grossHardMin: 10,
    grossTypicalMax: 800,
    outdoorExpected: false,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: true,
  },
  hall: {
    grossHardMin: 40,
    grossTypicalMax: 5000,
    outdoorExpected: false,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: false,
  },
  storage: {
    grossHardMin: 2,
    grossTypicalMax: 50,
    outdoorExpected: false,
    outdoorRequired: false,
    gardenTypical: false,
    ratioApplies: false,
  },
};

// =============================================================================
// 2. RATIO THRESHOLDS
// =============================================================================

/**
 * Ratio net/gross thresholds. Values outside the [low, high] range trigger
 * `unusual`. Εντός range = `ok`. Tuned στην ελληνική αγορά: typical 0.82–0.92,
 * tolerance widened to 0.60–0.95 για edge cases (tiny studios, converted lofts).
 */
export const AREA_RATIO_LOW = 0.60;
export const AREA_RATIO_HIGH = 0.95;

// =============================================================================
// 3. ASSESSMENT — public API
// =============================================================================

export type AreaVerdict = 'ok' | 'unusual' | 'implausible' | 'insufficientData';

/**
 * Reason code — identifies which rule triggered the verdict. Used by the UI
 * layer to pick the appropriate localized message.
 */
export type AreaReason =
  | 'netExceedsGross'       // net > gross (physical impossibility)
  | 'netZeroWithGross'      // net === 0 with gross > 0
  | 'grossBelowMin'         // gross < type hardMin
  | 'luxuryNoOutdoor'       // penthouse/villa/detached with 0 outdoor
  | 'grossAboveMax'         // gross > type typicalMax
  | 'netRatioTooLow'        // net/gross < 0.60
  | 'netRatioTooHigh'       // net/gross > 0.95
  | 'netEqualsGross'        // net === gross (no wall deduction)
  | 'noOutdoorResidential'  // residential with all outdoor === 0
  | 'gardenOnNonGround'     // garden > 0 on apartment/penthouse/etc.
  | null;

export interface AreaAssessment {
  readonly verdict: AreaVerdict;
  readonly reason: AreaReason;
  readonly propertyType: PropertyTypeCanonical | null;
  readonly rule: AreaRule | null;
  readonly gross: number | null;
  readonly net: number | null;
  readonly balcony: number | null;
  readonly terrace: number | null;
  readonly garden: number | null;
  /** Computed ratio net/gross, `null` αν δεν εφαρμόζεται. */
  readonly ratio: number | null;
}

export interface AssessAreaPlausibilityArgs {
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly gross: number | string | undefined | null;
  readonly net?: number | string | undefined | null;
  readonly balcony?: number | string | undefined | null;
  readonly terrace?: number | string | undefined | null;
  readonly garden?: number | string | undefined | null;
}

/**
 * Assess whether the area measurements are plausible for the given property
 * type.
 *
 * **Gate order**:
 *   1. `propertyType` must be known → otherwise `insufficientData`.
 *   2. Αν `gross` λείπει/0 και όλα τα υπόλοιπα 0 → `insufficientData`
 *      (silent wait — ο χρήστης δεν έχει πληκτρολογήσει ακόμα).
 *   3. `netExceedsGross` (implausible).
 *   4. `netZeroWithGross` (implausible).
 *   5. `grossBelowMin` (implausible).
 *   6. `luxuryNoOutdoor` (implausible).
 *   7. `grossAboveMax` (unusual).
 *   8. `netRatioTooLow` / `netRatioTooHigh` / `netEqualsGross` (unusual).
 *   9. `noOutdoorResidential` (unusual).
 *  10. `gardenOnNonGround` (unusual).
 *  11. Otherwise → `ok`.
 *
 * **Single-reason surfacing**: Επιστρέφουμε την πιο σοβαρή παραβίαση (priority
 * order παραπάνω). Αποφεύγουμε overwhelm του χρήστη με multiple warnings.
 */
export function assessAreaPlausibility(
  args: AssessAreaPlausibilityArgs,
): AreaAssessment {
  const { propertyType } = args;

  if (!isKnownPropertyType(propertyType)) {
    return emptyAssessment('insufficientData');
  }

  const gross = toNonNegativeNumber(args.gross);
  const net = toNonNegativeNumber(args.net);
  const balcony = toNonNegativeNumber(args.balcony);
  const terrace = toNonNegativeNumber(args.terrace);
  const garden = toNonNegativeNumber(args.garden);

  const hasAnyValue =
    (gross !== null && gross > 0) ||
    (net !== null && net > 0) ||
    (balcony !== null && balcony > 0) ||
    (terrace !== null && terrace > 0) ||
    (garden !== null && garden > 0);

  if (!hasAnyValue) {
    return {
      ...emptyAssessment('insufficientData'),
      propertyType,
      rule: AREA_RULES[propertyType],
    };
  }

  const rule = AREA_RULES[propertyType];
  const grossValue = gross ?? 0;
  const netValue = net ?? 0;
  const outdoorSum = (balcony ?? 0) + (terrace ?? 0) + (garden ?? 0);

  // Step 3: net > gross (physical impossibility)
  if (grossValue > 0 && netValue > grossValue) {
    return buildAssessment('implausible', 'netExceedsGross', propertyType, rule, gross, net, balcony, terrace, garden);
  }

  // Step 4: net === 0 with gross > 0 (implausible per Giorgio direction)
  if (grossValue > 0 && net !== null && net === 0 && rule.ratioApplies) {
    return buildAssessment('implausible', 'netZeroWithGross', propertyType, rule, gross, net, balcony, terrace, garden);
  }

  // Step 5: gross < type hardMin
  if (grossValue > 0 && rule.grossHardMin !== null && grossValue < rule.grossHardMin) {
    return buildAssessment('implausible', 'grossBelowMin', propertyType, rule, gross, net, balcony, terrace, garden);
  }

  // Step 6: luxury without any outdoor (penthouse/villa/detached)
  if (rule.outdoorRequired && grossValue > 0 && outdoorSum === 0) {
    return buildAssessment('implausible', 'luxuryNoOutdoor', propertyType, rule, gross, net, balcony, terrace, garden);
  }

  // Step 7: gross > type typicalMax (unusual)
  if (grossValue > 0 && rule.grossTypicalMax !== null && grossValue > rule.grossTypicalMax) {
    return buildAssessment('unusual', 'grossAboveMax', propertyType, rule, gross, net, balcony, terrace, garden);
  }

  // Step 8: ratio checks (only if ratio applies και έχουμε και τα δύο)
  if (rule.ratioApplies && grossValue > 0 && netValue > 0) {
    const ratio = netValue / grossValue;

    if (ratio < AREA_RATIO_LOW) {
      return buildAssessment('unusual', 'netRatioTooLow', propertyType, rule, gross, net, balcony, terrace, garden, ratio);
    }
    if (ratio > AREA_RATIO_HIGH && netValue !== grossValue) {
      return buildAssessment('unusual', 'netRatioTooHigh', propertyType, rule, gross, net, balcony, terrace, garden, ratio);
    }
    if (netValue === grossValue) {
      return buildAssessment('unusual', 'netEqualsGross', propertyType, rule, gross, net, balcony, terrace, garden, ratio);
    }
  }

  // Step 9: residential χωρίς κανένα outdoor (apt/maisonette)
  if (rule.outdoorExpected && grossValue > 0 && outdoorSum === 0) {
    return buildAssessment('unusual', 'noOutdoorResidential', propertyType, rule, gross, net, balcony, terrace, garden);
  }

  // Step 10: garden σε τύπο που δεν είναι ground-level (apt/penthouse/loft)
  if (!rule.gardenTypical && (garden ?? 0) > 0 && propertyType !== 'shop' && propertyType !== 'office' && propertyType !== 'hall' && propertyType !== 'storage') {
    return buildAssessment('unusual', 'gardenOnNonGround', propertyType, rule, gross, net, balcony, terrace, garden);
  }

  // All checks passed
  return buildAssessment('ok', null, propertyType, rule, gross, net, balcony, terrace, garden);
}

/**
 * Convenience: returns `true` αν το verdict χρειάζεται εμφάνιση ως warning.
 */
export function isActionableAreaVerdict(
  verdict: AreaVerdict,
): verdict is 'unusual' | 'implausible' {
  return verdict === 'unusual' || verdict === 'implausible';
}

// =============================================================================
// 4. INTERNAL HELPERS
// =============================================================================

function emptyAssessment(verdict: AreaVerdict): AreaAssessment {
  return {
    verdict,
    reason: null,
    propertyType: null,
    rule: null,
    gross: null,
    net: null,
    balcony: null,
    terrace: null,
    garden: null,
    ratio: null,
  };
}

function buildAssessment(
  verdict: AreaVerdict,
  reason: AreaReason,
  propertyType: PropertyTypeCanonical,
  rule: AreaRule,
  gross: number | null,
  net: number | null,
  balcony: number | null,
  terrace: number | null,
  garden: number | null,
  ratio: number | null = null,
): AreaAssessment {
  const computedRatio =
    ratio !== null
      ? ratio
      : gross !== null && gross > 0 && net !== null && net > 0
        ? net / gross
        : null;
  return {
    verdict,
    reason,
    propertyType,
    rule,
    gross,
    net,
    balcony,
    terrace,
    garden,
    ratio: computedRatio,
  };
}

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

/**
 * Accepts `number | string | null | undefined`, επιστρέφει non-negative finite
 * number ή `null`. Αρνητικοί / non-finite / empty string → `null`.
 * Δέχεται decimals (σε αντίθεση με το toNonNegativeInt του layout-plausibility)
 * επειδή εμβαδά εκφράζονται τυπικά σε decimal τ.μ. (π.χ. 85.5 τ.μ.).
 */
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
