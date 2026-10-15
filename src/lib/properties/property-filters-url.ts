/**
 * @fileoverview **ΔΙΕΥΘΥΝΣΗ ⇄ ΦΙΛΤΡΑ ΑΚΙΝΗΤΩΝ** — η «Διαθέσιμα Ακίνητα» θυμάται τι ζήτησε ο άνθρωπος, σε κάθε προβολή.
 * @module lib/properties/property-filters-url
 * @see ADR-840 §7.7 · lib/criteria/listing-criteria-url (η ίδια σύμβαση στη δημόσια αναζήτηση)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ — ΚΑΙ ΟΧΙ ΣΕ CONTEXT/STORE
 * ─────────────────────────────────────────────────────────────────────────────
 * Πλέγμα και κάτοψη είναι **δύο όψεις της ΙΔΙΑΣ αναζήτησης** (ADR-840 Α2) — το μοτίβο των portals
 * (Zillow · Idealista: λίστα ↔ χάρτης, ίδια φίλτρα, στο URL). Ως τις 2026-10-15 κάθε προβολή κρατούσε **δική της**
 * `useState<FilterState>` ⇒ η εναλλαγή (unmount) τα έσβηνε. Ένα κοινό store θα έλυνε **μόνο** την εναλλαγή· η
 * διεύθυνση λύνει και refresh, και «πίσω», και κοινοποίηση — χωρίς δεύτερο δοχείο (`lib/url-query-state`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΑ ΟΝΟΜΑΤΑ ΕΙΝΑΙ ΔΗΜΟΣΙΟ ΣΥΜΒΟΛΑΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ταξιδεύουν σε κάθε σύνδεσμο και σελιδοδείκτη: αλλαγή εδώ **σπάει παλιούς συνδέσμους**.
 * - Τιμή & εμβαδόν: **τα ίδια ονόματα** με τη δημόσια αναζήτηση για την ίδια ερώτηση (`rangeParams`):
 *   `psalemin`/`prentmax`/`pnightmin` — **η μονάδα ζει στο όνομα** (ADR-777 §8.60.14.14), άρα ο σύνδεσμος δεν
 *   μπορεί να είναι διφορούμενος· `amin`/`amax`.
 * - Έργο / κτίριο: **ταυτότητες** (ADR-840 §7.6) — σταθερές σε μετονομασία.
 *
 * ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ `listing-criteria-url`, ΚΛΗΡΟΝΟΜΗΜΕΝΟΙ:
 * 1. **Άγνωστη τιμή αγνοείται** — ποτέ δεν σκάει η οθόνη. 2. **Τα κενά δεν γράφονται**. 3. `parse → write` κανονικοποιεί.
 * 4. Άσχετα κλειδιά (`view`, `selected`, …) **δεν αγγίζονται** — η γραφή είναι μετάλλαξη επί τόπου.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις πάνω σε `URLSearchParams`.
 */

import { priceAxisOfRole } from '@/lib/criteria/listing-criterion-reading';
import { rangeParams, readFiniteNumber } from '@/lib/criteria/listing-criteria-url';
import { EMPTY_PRICE_RANGE, type RolePriceRange } from '@/lib/properties/price-range';
import { PRICE_ROLES } from '@/lib/properties/price-resolver';
import { urlEnumParam } from '@/lib/url-filters/enum-param';
import { parseFilterArray, serializeFilterArray } from '@/lib/url-filters/multi-value';
import type { NumericRange } from '@/components/core/AdvancedFilters/types';
import { DEFAULT_FILTERS, type FilterState } from '@/types/property-viewer';

// =============================================================================
// 1. Η ΠΡΟΒΟΛΗ — `?view=floorplan` (ADR-840 Α2)
// =============================================================================

export const PROPERTIES_VIEWS = ['grid', 'floorplan'] as const;
export type PropertiesView = (typeof PROPERTIES_VIEWS)[number];

/** Το πλέγμα είναι η προεπιλογή και **δεν** γράφεται· η κάτοψη είναι `?view=floorplan` (η υπάρχουσα σύμβαση). */
export const PROPERTIES_VIEW = urlEnumParam<PropertiesView>({
  param: 'view',
  values: PROPERTIES_VIEWS,
  fallback: 'grid',
});

/** Το ακίνητο που ανοίγει **επιλεγμένο** στην κάτοψη (`useUrlPreselect`). */
export const PROPERTIES_SELECTED_PARAM = 'selected';

// =============================================================================
// 2. ΤΑ ΦΙΛΤΡΑ
// =============================================================================

/** Τα κλειδιά των φίλτρων λίστας — `Record` πάνω στα πεδία, ώστε νέο πεδίο-πίνακας να ζητά όνομα. */
const LIST_PARAM = {
  project: 'project',
  building: 'building',
  floor: 'floor',
  propertyType: 'type',
  status: 'status',
  features: 'features',
} as const satisfies Partial<Record<keyof FilterState, string>>;

type ListFilterKey = keyof typeof LIST_PARAM;
const LIST_KEYS = Object.keys(LIST_PARAM) as ListFilterKey[];

/**
 * ⚠️ Ο όρος γράφεται **αυτούσιος** (όχι `trim`): η κατάσταση **παράγεται** από τη διεύθυνση, άρα ένα `trim` στη
 * γραφή θα έτρωγε το κενό τη στιγμή που πληκτρολογείται — «δύο λέξεις» δεν θα γραφόταν ποτέ.
 */
export const SEARCH_TERM_PARAM = 'q';
const AREA_PARAMS = rangeParams('areaSqm');

/**
 * **Η μονάδα ενός εύρους ΧΩΡΙΣ όρια ακόμη** — ο άνθρωπος διάλεξε «€/μήνα» και δεν έγραψε αριθμό.
 *
 * 🔑 Γράφεται **μόνο** τότε, και μόνο όταν δεν είναι η προεπιλογή: με όρια, η μονάδα ζει ήδη στο **όνομα** τους
 *    (`prentmin`) — δεύτερη δήλωσή της θα ήταν δεύτερη αλήθεια, ελεύθερη να διαφωνεί.
 */
export const PRICE_UNIT_PARAM = 'punit';

const PRICE_UNIT = urlEnumParam({ param: PRICE_UNIT_PARAM, values: PRICE_ROLES, fallback: EMPTY_PRICE_RANGE.role });

/** Τα δύο άκρα της τιμής **στη μονάδα του ρόλου** — π.χ. `psalemin`/`psalemax`. */
function priceParams(role: RolePriceRange['role']): { readonly min: string; readonly max: string } {
  return rangeParams(priceAxisOfRole(role));
}

/** Ο **πρώτος** ρόλος (με τη δηλωμένη σειρά) που ο σύνδεσμος ρωτά — ένα εύρος έχει ΜΙΑ μονάδα. */
function readPriceRange(params: URLSearchParams): RolePriceRange {
  for (const role of PRICE_ROLES) {
    const names = priceParams(role);
    const min = readFiniteNumber(params, names.min);
    const max = readFiniteNumber(params, names.max);
    if (min !== null || max !== null) return { role, min, max };
  }
  const role = PRICE_UNIT.parse(params);
  return role === EMPTY_PRICE_RANGE.role ? EMPTY_PRICE_RANGE : { role };
}

function readRange(params: URLSearchParams, names: { readonly min: string; readonly max: string }): NumericRange {
  return {
    min: readFiniteNumber(params, names.min) ?? undefined,
    max: readFiniteNumber(params, names.max) ?? undefined,
  };
}

/** Ανάγνωση. Ό,τι λείπει ή είναι άκυρο ⇒ η κενή τιμή του `DEFAULT_FILTERS`. */
export function parsePropertyFilters(params: URLSearchParams): FilterState {
  const filters: FilterState = {
    ...DEFAULT_FILTERS,
    searchTerm: params.get(SEARCH_TERM_PARAM) ?? '',
    priceRange: readPriceRange(params),
    areaRange: readRange(params, AREA_PARAMS),
  };
  for (const key of LIST_KEYS) filters[key] = parseFilterArray(params.get(LIST_PARAM[key]));
  return filters;
}

function writeValue(params: URLSearchParams, name: string, value: string | undefined): void {
  if (value === undefined || value === '') params.delete(name);
  else params.set(name, value);
}

function writeBound(params: URLSearchParams, name: string, value: number | null | undefined): void {
  writeValue(params, name, typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined);
}

/**
 * Γραφή **επί τόπου**: σβήνει κάθε κλειδί φίλτρου και γράφει μόνο τα ενεργά. Η τιμή καθαρίζει **και τους τρεις**
 * ρόλους πριν γράψει τον έναν — αλλιώς αλλαγή μονάδας θα άφηνε το παλιό εύρος να ζει δίπλα στο νέο.
 */
export function writePropertyFilters(filters: FilterState, params: URLSearchParams): void {
  writeValue(params, SEARCH_TERM_PARAM, filters.searchTerm.trim() ? filters.searchTerm : undefined);
  for (const key of LIST_KEYS) writeValue(params, LIST_PARAM[key], serializeFilterArray(filters[key]));

  for (const role of PRICE_ROLES) {
    const names = priceParams(role);
    params.delete(names.min);
    params.delete(names.max);
  }
  const price = filters.priceRange;
  const priceNames = priceParams(price.role);
  writeBound(params, priceNames.min, price.min);
  writeBound(params, priceNames.max, price.max);
  const bounded = params.has(priceNames.min) || params.has(priceNames.max);
  if (bounded) params.delete(PRICE_UNIT_PARAM);
  else PRICE_UNIT.write(price.role, params);

  writeBound(params, AREA_PARAMS.min, filters.areaRange.min);
  writeBound(params, AREA_PARAMS.max, filters.areaRange.max);
}
