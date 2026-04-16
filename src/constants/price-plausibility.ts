/**
 * =============================================================================
 * SSoT: Asking Price Plausibility Ranges (Google-style sanity check)
 * =============================================================================
 *
 * **Single Source of Truth** για το "is this asking price realistic?" check.
 * Χρησιμοποιείται από inline UX warnings (non-blocking) όταν ο χρήστης
 * πληκτρολογεί μια τιμή πώλησης/ενοικίασης που είναι εκτός εύλογου εύρους
 * για τον τύπο ακινήτου και την εμπορική κατάσταση.
 *
 * **Google pattern**: "Plausibility / sanity check" — δείχνουμε warning,
 * **ποτέ δεν μπλοκάρουμε** το save. Ο χρήστης μπορεί να έχει έγκυρο λόγο
 * (test data, edge case, κρυφή συμφωνία). Τα warnings εμφανίζονται μόνο όταν
 * υπάρχουν αρκετά δεδομένα (price + grossArea + type + status) για μια
 * αξιόπιστη εκτίμηση, ώστε να αποφεύγεται το alert fatigue.
 *
 * **Layering**: Leaf module — εξαρτάται μόνο από άλλα leaf constants
 * (`commercial-statuses.ts`, `property-types.ts`). Ασφαλές για import παντού.
 *
 * **Tier 1 (static ranges)**: Hardcoded €/τ.μ. ranges ομαδοποιημένα σε
 * 3 property classes (residential / commercial / auxiliary) × 2 listing modes
 * (sale / rent). Δεν απαιτεί Firestore aggregation — immediate feedback.
 *
 * **Tier 2 (TODO, future batch)**: Per-project median benchmark — compare
 * με median €/τ.μ. των sibling properties στο ίδιο project/type. Απαιτεί
 * aggregation query + ≥5 properties for statistical validity.
 *
 * **Προσθήκη νέου listing mode ή type group**: επέκταση του
 * `PLAUSIBILITY_RANGES` array. Το helper υπολογίζει αυτόματα το verdict.
 *
 * @module constants/price-plausibility
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 17)
 */

import {
  isListedCommercialStatus,
  type CommercialStatus,
  type ListedCommercialStatus,
} from '@/constants/commercial-statuses';
import type { PropertyTypeCanonical } from '@/constants/property-types';

// =============================================================================
// 1. PROPERTY TYPE CLASSIFICATION — 3 groups για range lookup
// =============================================================================

/**
 * Property classes για price plausibility grouping. Διαφορετικές ομάδες έχουν
 * ριζικά διαφορετικά €/τ.μ. ranges — π.χ. auxiliary (storage) ~100€/τ.μ. sale,
 * commercial (shop high street) μπορεί να φτάσει 10000€/τ.μ.
 */
export type PropertyPriceClass = 'residential' | 'commercial' | 'auxiliary';

const COMMERCIAL_TYPES: ReadonlySet<string> = new Set<PropertyTypeCanonical>([
  'shop',
  'office',
  'hall',
]);

const AUXILIARY_TYPES: ReadonlySet<string> = new Set<PropertyTypeCanonical>([
  'storage',
]);

/**
 * Classify a property type into one of 3 price classes.
 *
 * Unknown / empty / legacy values → `'residential'` (safest default —
 * residential has the widest plausibility band, so we avoid false positives
 * on legacy data).
 */
export function classifyPropertyTypeForPricing(
  type: unknown,
): PropertyPriceClass {
  if (typeof type !== 'string' || type.length === 0) return 'residential';
  if (COMMERCIAL_TYPES.has(type)) return 'commercial';
  if (AUXILIARY_TYPES.has(type)) return 'auxiliary';
  return 'residential';
}

// =============================================================================
// 2. LISTING MODE — sale vs rent (derived from CommercialStatus)
// =============================================================================

export type ListingPriceMode = 'sale' | 'rent';

/**
 * Από `ListedCommercialStatus` → price mode:
 *   - `for-sale` / `for-sale-and-rent` → `'sale'` (asking price συνήθως εκφράζει sale price)
 *   - `for-rent` → `'rent'` (monthly rent)
 *
 * Για `for-sale-and-rent` επιλέγουμε το sale range (conservative — το sale
 * price είναι συνήθως το primary asking, και η έκταση του range καλύπτει
 * τις περισσότερες περιπτώσεις).
 */
function listingModeOf(status: ListedCommercialStatus): ListingPriceMode {
  return status === 'for-rent' ? 'rent' : 'sale';
}

// =============================================================================
// 3. STATIC RANGES — Tier 1 SSoT (Greece, 2026 baseline)
// =============================================================================

export interface PlausibilityRange {
  /** Κάτω όριο €/τ.μ. (εύλογου εύρους αγοράς). Κάτω από αυτό → suspiciousLow. */
  readonly minPerSqm: number;
  /** Άνω όριο €/τ.μ. Πάνω από αυτό → suspiciousHigh. */
  readonly maxPerSqm: number;
  /**
   * Απόλυτο floor σε συνολικό price (όχι €/τ.μ.). Κάτω από αυτό → hardFloor
   * (σχεδόν σίγουρα typo). Anti-typo net.
   */
  readonly absoluteFloor: number;
}

/**
 * Tier 1 ranges. Values είναι εύλογα για Ελλάδα 2026 (από ευρύτερη περιφέρεια
 * έως Αθήνα/Θεσσαλονίκη premium). Σκόπιμα γενναιόδωρα για να αποφεύγεται
 * alert fatigue — στόχος είναι να πιάσουμε **typos** (1€ vs 100000€), όχι
 * να κριτικάρουμε business decisions.
 */
export const PLAUSIBILITY_RANGES: Readonly<
  Record<ListingPriceMode, Record<PropertyPriceClass, PlausibilityRange>>
> = {
  sale: {
    residential: { minPerSqm: 300, maxPerSqm: 8000, absoluteFloor: 1000 },
    commercial: { minPerSqm: 400, maxPerSqm: 10000, absoluteFloor: 1000 },
    auxiliary: { minPerSqm: 100, maxPerSqm: 3000, absoluteFloor: 500 },
  },
  rent: {
    residential: { minPerSqm: 2, maxPerSqm: 40, absoluteFloor: 50 },
    commercial: { minPerSqm: 5, maxPerSqm: 80, absoluteFloor: 50 },
    auxiliary: { minPerSqm: 0.5, maxPerSqm: 15, absoluteFloor: 10 },
  },
};

// =============================================================================
// 4. ASSESSMENT — public API
// =============================================================================

export type PlausibilityVerdict =
  | 'ok'
  | 'insufficientData'
  | 'hardFloor'
  | 'suspiciousLow'
  | 'suspiciousHigh';

export interface PlausibilityAssessment {
  readonly verdict: PlausibilityVerdict;
  readonly mode: ListingPriceMode | null;
  readonly priceClass: PropertyPriceClass | null;
  /** €/τ.μ. calculated (null αν δεν υπάρχει αρκετή πληροφορία). */
  readonly pricePerSqm: number | null;
  /** Expected band που αξιολογήθηκε το input (null αν δεν έγινε check). */
  readonly expected: PlausibilityRange | null;
}

export interface AssessPricePlausibilityArgs {
  readonly commercialStatus: CommercialStatus | string | undefined | null;
  readonly propertyType: PropertyTypeCanonical | string | undefined | null;
  readonly askingPrice: number | string | undefined | null;
  readonly grossArea: number | string | undefined | null;
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Google-style plausibility assessment για asking price. Δεν μπλοκάρει save —
 * επιστρέφει verdict που ο UI layer μπορεί να εμφανίσει ως warning.
 *
 * **Gate order**:
 *   1. Status πρέπει να είναι `listed` (διαφορετικά → `'ok'`, no price expected)
 *   2. `askingPrice` πρέπει να υπάρχει & > 0 (διαφορετικά → `'insufficientData'`)
 *   3. Absolute floor check (hardFloor αν < `absoluteFloor`)
 *   4. `grossArea` πρέπει να υπάρχει & > 0 για €/τ.μ. check (διαφορετικά → `'ok'`
 *      μόλις περάσει το hardFloor — δεν έχουμε δεδομένα για band check)
 *   5. €/τ.μ. vs `[minPerSqm, maxPerSqm]`
 */
export function assessPricePlausibility(
  args: AssessPricePlausibilityArgs,
): PlausibilityAssessment {
  const { commercialStatus, propertyType, askingPrice, grossArea } = args;

  if (!isListedCommercialStatus(commercialStatus)) {
    return emptyVerdict('ok');
  }

  const price = toPositiveNumber(askingPrice);
  if (price === null) {
    return emptyVerdict('insufficientData');
  }

  const mode = listingModeOf(commercialStatus);
  const priceClass = classifyPropertyTypeForPricing(propertyType);
  const range = PLAUSIBILITY_RANGES[mode][priceClass];

  if (price < range.absoluteFloor) {
    return {
      verdict: 'hardFloor',
      mode,
      priceClass,
      pricePerSqm: null,
      expected: range,
    };
  }

  const area = toPositiveNumber(grossArea);
  if (area === null) {
    return { verdict: 'ok', mode, priceClass, pricePerSqm: null, expected: range };
  }

  const pricePerSqm = price / area;
  if (pricePerSqm < range.minPerSqm) {
    return {
      verdict: 'suspiciousLow',
      mode,
      priceClass,
      pricePerSqm,
      expected: range,
    };
  }
  if (pricePerSqm > range.maxPerSqm) {
    return {
      verdict: 'suspiciousHigh',
      mode,
      priceClass,
      pricePerSqm,
      expected: range,
    };
  }
  return { verdict: 'ok', mode, priceClass, pricePerSqm, expected: range };
}

function emptyVerdict(verdict: PlausibilityVerdict): PlausibilityAssessment {
  return {
    verdict,
    mode: null,
    priceClass: null,
    pricePerSqm: null,
    expected: null,
  };
}

/**
 * Convenience: warning που χρειάζεται εμφάνιση. Όλα τα μη-'ok' verdicts
 * (εκτός του `insufficientData` που σιωπηλά περιμένει δεδομένα).
 */
export function isActionableVerdict(
  verdict: PlausibilityVerdict,
): verdict is 'hardFloor' | 'suspiciousLow' | 'suspiciousHigh' {
  return (
    verdict === 'hardFloor' ||
    verdict === 'suspiciousLow' ||
    verdict === 'suspiciousHigh'
  );
}
