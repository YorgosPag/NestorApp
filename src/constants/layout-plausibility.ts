/**
 * =============================================================================
 * SSoT: Layout (bedrooms / bathrooms / WC) Plausibility
 * =============================================================================
 *
 * **Single Source of Truth** για το "is the room layout consistent with the
 * property type?" check. Εμφανίζεται σαν inline non-blocking warning όταν ο
 * χρήστης εισάγει συνδυασμό υπνοδωματίων / μπάνιων / WC που δεν συνάδει με
 * τον ορισμό του τύπου (π.χ. στούντιο με 2 υπνοδωμάτια, γκαρσονιέρα με 0,
 * διαμέρισμα χωρίς sanitary facilities).
 *
 * **Google pattern**: Plausibility / sanity check — ΠΟΤΕ δεν μπλοκάρει το save.
 * Ο χρήστης μπορεί να έχει legitimate reason (raw/unfinished unit, loft
 * industriale, mezzanine conversion). Warning = UX hint για να πιάσει typos ή
 * λάθος τύπο.
 *
 * **Layering**: Leaf module — εξαρτάται μόνο από `property-types.ts`. Ασφαλές
 * για import παντού.
 *
 * **Definitions** (Greek/EU real-estate + Zillow/Idealista patterns):
 *   - Studio (στούντιο): open-plan, **0 bedrooms** by definition
 *   - Γκαρσονιέρα (apartment_1br): **1 bedroom** (ελληνικός ορισμός strict)
 *   - Apartment+: **≥1 bedroom**
 *   - Villa: typically ≥2 bedrooms + dedicated bathroom
 *   - Commercial (shop/office/hall): **no bedrooms**, requires WC (Greek law)
 *   - Storage: 0/0/0 canonical
 *
 * **Sanitary rule** (residential): `bathrooms + wc ≥ 1` — μπάνιο ή WC
 * σημαίνει ότι υπάρχει τουαλέτα. 0/0/0 residential → `unusual` (raw/unfinished).
 *
 * @module constants/layout-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 20)
 */

import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. PER-TYPE RULES
// =============================================================================

export interface LayoutRule {
  /** Minimum expected bedrooms. `null` = not applicable (non-residential). */
  readonly bedroomMin: number | null;
  /** Maximum expected bedrooms. `null` = no cap. */
  readonly bedroomMax: number | null;
  /**
   * Αν `true`, bedrooms εκτός [min, max] → `implausible` (contradicts definition).
   * Αν `false`, εκτός range → `unusual` (atypical αλλά πιθανό).
   */
  readonly bedroomStrict: boolean;
  /**
   * Αν `true`, απαιτείται `bathrooms + wc ≥ 1`. Διαφορετικά → `unusual` verdict.
   * Residential types: true. Storage: false.
   */
  readonly requiresSanitary: boolean;
  /**
   * Αν `true`, απαιτείται τουλάχιστον 1 dedicated bathroom (`bathrooms ≥ 1`).
   * Εφαρμόζεται σε luxury/family residential (penthouse, villa, detached_house).
   * Διαφορετικά → `unusual`.
   */
  readonly requiresDedicatedBathroom: boolean;
  /**
   * Αν `true`, απαιτείται τουλάχιστον 1 WC (`wc ≥ 1`). Εφαρμόζεται σε commercial
   * types (shop/office/hall per Greek commercial code). Διαφορετικά → `unusual`.
   */
  readonly requiresDedicatedWC: boolean;
}

/**
 * Google-style business rules per property type.
 *
 * **bedroomStrict semantics**:
 *   - `true` = contradicts definition (studio with bedrooms, γκαρσονιέρα with
 *     wrong count, commercial with bedrooms) → `implausible`
 *   - `false` = atypical but possible → `unusual`
 */
export const LAYOUT_RULES: Readonly<Record<PropertyTypeCanonical, LayoutRule>> = {
  studio: {
    bedroomMin: 0,
    bedroomMax: 0,
    bedroomStrict: true,
    requiresSanitary: true,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: false,
  },
  apartment_1br: {
    bedroomMin: 1,
    bedroomMax: 1,
    bedroomStrict: true,
    requiresSanitary: true,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: false,
  },
  apartment: {
    bedroomMin: 1,
    bedroomMax: null,
    bedroomStrict: true,
    requiresSanitary: true,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: false,
  },
  maisonette: {
    bedroomMin: 1,
    bedroomMax: null,
    bedroomStrict: true,
    requiresSanitary: true,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: false,
  },
  penthouse: {
    bedroomMin: 1,
    bedroomMax: null,
    bedroomStrict: true,
    requiresSanitary: true,
    requiresDedicatedBathroom: true,
    requiresDedicatedWC: false,
  },
  loft: {
    bedroomMin: 0,
    bedroomMax: 2,
    bedroomStrict: false,
    requiresSanitary: true,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: false,
  },
  detached_house: {
    bedroomMin: 1,
    bedroomMax: null,
    bedroomStrict: true,
    requiresSanitary: true,
    requiresDedicatedBathroom: true,
    requiresDedicatedWC: false,
  },
  villa: {
    bedroomMin: 2,
    bedroomMax: null,
    bedroomStrict: false,
    requiresSanitary: true,
    requiresDedicatedBathroom: true,
    requiresDedicatedWC: false,
  },
  shop: {
    bedroomMin: null,
    bedroomMax: 0,
    bedroomStrict: true,
    requiresSanitary: false,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: true,
  },
  office: {
    bedroomMin: null,
    bedroomMax: 0,
    bedroomStrict: true,
    requiresSanitary: false,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: true,
  },
  hall: {
    bedroomMin: null,
    bedroomMax: 0,
    bedroomStrict: true,
    requiresSanitary: false,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: true,
  },
  storage: {
    bedroomMin: null,
    bedroomMax: 0,
    bedroomStrict: true,
    requiresSanitary: false,
    requiresDedicatedBathroom: false,
    requiresDedicatedWC: false,
  },
};

// =============================================================================
// 2. ASSESSMENT — public API
// =============================================================================

export type LayoutVerdict = 'ok' | 'unusual' | 'implausible' | 'insufficientData';

/**
 * Reason code — identifies which rule triggered the verdict. Used by the UI
 * layer to pick the appropriate localized message.
 */
export type LayoutReason =
  | 'bedroomMismatch' // bedrooms outside [min, max], strict type
  | 'bedroomAtypical' // bedrooms outside expected, loose type (loft, villa)
  | 'bedroomsForbidden' // bedrooms > 0 on commercial/storage
  | 'noSanitary' // residential with bathrooms + wc === 0
  | 'noDedicatedBathroom' // luxury residential with bathrooms === 0
  | 'noDedicatedWC' // commercial with wc === 0
  | null;

export interface LayoutAssessment {
  readonly verdict: LayoutVerdict;
  readonly reason: LayoutReason;
  readonly propertyType: PropertyTypeCanonical | null;
  readonly rule: LayoutRule | null;
  readonly bedrooms: number | null;
  readonly bathrooms: number | null;
  readonly wc: number | null;
}

export interface AssessLayoutPlausibilityArgs {
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly bedrooms: number | string | undefined | null;
  readonly bathrooms: number | string | undefined | null;
  readonly wc: number | string | undefined | null;
}

/**
 * Assess whether the bedroom/bathroom/WC counts are plausible for the given
 * property type.
 *
 * **Gate order**:
 *   1. `propertyType` must be known → otherwise `insufficientData`.
 *   2. Αν όλα τα counts είναι null/undefined → `insufficientData` (silent wait).
 *   3. Bedroom constraint check — strict types → `implausible`, loose → `unusual`.
 *   4. Sanitary checks — `noSanitary` / `noDedicatedBathroom` / `noDedicatedWC`.
 *   5. Otherwise → `ok`.
 *
 * **Single-reason surfacing**: Επιστρέφουμε την πιο σοβαρή παραβίαση (priority
 * order παραπάνω). Αποφεύγουμε overwhelm του χρήστη με multiple warnings.
 */
export function assessLayoutPlausibility(
  args: AssessLayoutPlausibilityArgs,
): LayoutAssessment {
  const { propertyType } = args;

  if (!isKnownPropertyType(propertyType)) {
    return emptyAssessment('insufficientData');
  }

  const bedrooms = toNonNegativeInt(args.bedrooms);
  const bathrooms = toNonNegativeInt(args.bathrooms);
  const wc = toNonNegativeInt(args.wc);

  if (bedrooms === null && bathrooms === null && wc === null) {
    return {
      verdict: 'insufficientData',
      reason: null,
      propertyType,
      rule: LAYOUT_RULES[propertyType],
      bedrooms: null,
      bathrooms: null,
      wc: null,
    };
  }

  const rule = LAYOUT_RULES[propertyType];

  // Step 3: Bedroom constraint
  if (bedrooms !== null) {
    const belowMin = rule.bedroomMin !== null && bedrooms < rule.bedroomMin;
    const aboveMax = rule.bedroomMax !== null && bedrooms > rule.bedroomMax;

    if (belowMin || aboveMax) {
      const forbidden =
        rule.bedroomMax === 0 && bedrooms > 0 && rule.bedroomMin === null;
      const reason: LayoutReason = forbidden
        ? 'bedroomsForbidden'
        : rule.bedroomStrict
          ? 'bedroomMismatch'
          : 'bedroomAtypical';
      const verdict: LayoutVerdict = rule.bedroomStrict
        ? 'implausible'
        : 'unusual';
      return {
        verdict,
        reason,
        propertyType,
        rule,
        bedrooms,
        bathrooms,
        wc,
      };
    }
  }

  // Step 4: Sanitary checks (requires both bathrooms + wc resolved to be sure).
  // Αν ένα από τα δύο λείπει, θεωρούμε unknown για αυτόν τον έλεγχο — skip για να
  // αποφύγουμε false positives κατά data entry.
  const sanitaryResolved = bathrooms !== null && wc !== null;

  if (sanitaryResolved) {
    if (rule.requiresDedicatedWC && wc === 0) {
      return {
        verdict: 'unusual',
        reason: 'noDedicatedWC',
        propertyType,
        rule,
        bedrooms,
        bathrooms,
        wc,
      };
    }
    if (rule.requiresDedicatedBathroom && bathrooms === 0) {
      return {
        verdict: 'unusual',
        reason: 'noDedicatedBathroom',
        propertyType,
        rule,
        bedrooms,
        bathrooms,
        wc,
      };
    }
    if (rule.requiresSanitary && bathrooms + wc === 0) {
      return {
        verdict: 'unusual',
        reason: 'noSanitary',
        propertyType,
        rule,
        bedrooms,
        bathrooms,
        wc,
      };
    }
  }

  return {
    verdict: 'ok',
    reason: null,
    propertyType,
    rule,
    bedrooms,
    bathrooms,
    wc,
  };
}

/**
 * Convenience: returns `true` αν το verdict χρειάζεται εμφάνιση ως warning.
 */
export function isActionableLayoutVerdict(
  verdict: LayoutVerdict,
): verdict is 'unusual' | 'implausible' {
  return verdict === 'unusual' || verdict === 'implausible';
}

// =============================================================================
// 3. INTERNAL HELPERS
// =============================================================================

function emptyAssessment(verdict: LayoutVerdict): LayoutAssessment {
  return {
    verdict,
    reason: null,
    propertyType: null,
    rule: null,
    bedrooms: null,
    bathrooms: null,
    wc: null,
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
 * Accepts `number | string | null | undefined`, επιστρέφει non-negative integer
 * ή `null`. Αρνητικοί αριθμοί / non-integers / non-finite → `null`.
 */
function toNonNegativeInt(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }
  return null;
}
