/**
 * @fileoverview **Ό,τι μοιράζονται τα τρία έντυπα** — κλιμάκια, παλαιότητα κατά νόμο, κοινοί συντελεστές, τελικό γινόμενο.
 * @related ADR-898 · `objective-value-tables.ts` · `objective-value-residence.ts` · `objective-value-ancillary.ts`
 * @module lib/objective-value/objective-value-common
 *
 * 🔑 Οι **κοινοί** συντελεστές (συνιδιοκτησία, διατηρητέο/απαλλοτριωτέο, πέτρινοι τοίχοι) έχουν **ίδιες** τιμές στα
 * έντυπα 1, 4, 5 ⇒ ζουν εδώ μία φορά. Ο τρόπος κατασκευής **δεν** έχει (πρόχειρο 0,70 vs 0,80) ⇒ ο πίνακας περνά
 * ως όρισμα, ο κανόνας «ένας από τους τρεις + πρόσθετα η στέγη» γράφεται μία φορά.
 */

import {
  CO_OWNERSHIP_FACTOR,
  EXPROPRIATED_FACTOR,
  LISTED_FACTOR,
  THICK_WALLS_FACTOR,
  type Band,
} from './objective-value-tables';
import type {
  AppliedFactor,
  ConstructionKind,
  ObjectiveValueForm,
  ObjectiveValueInvalid,
  ObjectiveValueMissing,
  ObjectiveValueResult,
} from './objective-value-types';

export const POL_1149 = 'ΠΟΛ.1149/1994';

export function bandFactor(bands: readonly Band[], value: number): number {
  const band = bands.find((b) => value <= b.upTo);
  return (band ?? bands[bands.length - 1]).factor;
}

// ============================================================================
// ΠΑΛΑΙΟΤΗΤΑ ΚΑΤΑ ΝΟΜΟ (άρθ. 2 §20)
// ============================================================================

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(value);
  if (match === null) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * Έτη παλαιότητας όπως τα μετρά ο νόμος: αρχίζουν **δύο έτη μετά** την έκδοση (ή την τελευταία αναθεώρηση) της
 * οικοδομικής άδειας· υπόλοιπο **μικρότερο** του εξαμήνου δεν μετρά, εξάμηνο και πάνω μετρά ως έτος.
 * `null` αν κάποια ημερομηνία δεν είναι `YYYY-MM-DD`.
 */
export function legalAgeYears(permitIsoDate: string, valuationIsoDate: string): number | null {
  const permit = parseIsoDate(permitIsoDate);
  const valuation = parseIsoDate(valuationIsoDate);
  if (permit === null || valuation === null) return null;
  const startYear = permit.y + 2;
  const months = (valuation.y - startYear) * 12 + (valuation.m - permit.m) - (valuation.d < permit.d ? 1 : 0);
  if (months <= 0) return 0;
  const years = Math.floor(months / 12);
  return months % 12 >= 6 ? years + 1 : years;
}

// ============================================================================
// ΕΛΕΓΧΟΣ ΕΙΣΟΔΟΥ
// ============================================================================

/** Συλλέκτης ελλείψεων/παραβιάσεων: ο υπολογισμός προχωρά μόνο αν και τα δύο είναι άδεια. */
export class InputCheck {
  readonly missing: ObjectiveValueMissing[] = [];
  readonly problems: ObjectiveValueInvalid[] = [];

  /** Επιστρέφει την τιμή, ή καταγράφει την έλλειψη. */
  need<T>(value: T | null | undefined, key: ObjectiveValueMissing): T | null {
    if (value === null || value === undefined) {
      if (!this.missing.includes(key)) this.missing.push(key);
      return null;
    }
    return value;
  }

  invalidIf(condition: boolean, problem: ObjectiveValueInvalid): void {
    if (condition && !this.problems.includes(problem)) this.problems.push(problem);
  }

  /** Το αποτέλεσμα «δεν υπολογίζεται», ή `null` αν η είσοδος είναι πλήρης και έγκυρη. */
  blocked(form: ObjectiveValueForm): ObjectiveValueResult | null {
    if (this.problems.length > 0) return { kind: 'invalid', form, problems: this.problems };
    if (this.missing.length > 0) return { kind: 'needsInput', form, missing: this.missing };
    return null;
  }
}

/** Έλεγχοι κοινοί σε όλα τα έντυπα: τιμή ζώνης, ΣΕ ≥ 1, παλαιότητα ≥ 0, ποσοστό κυριότητας. */
export function checkCommon(
  check: InputCheck,
  input: { zonePrice: number | null; commercialityFactor?: number | null; ageYears?: number | null; ownershipShare?: number },
): void {
  const zonePrice = check.need(input.zonePrice, 'zonePrice');
  check.invalidIf(zonePrice !== null && !(zonePrice > 0), 'nonPositiveZonePrice');
  const se = input.commercialityFactor;
  check.invalidIf(se !== null && se !== undefined && !(se >= 1), 'commercialityBelowOne');
  const age = input.ageYears;
  check.invalidIf(age !== null && age !== undefined && !(age >= 0), 'negativeAge');
  const share = input.ownershipShare ?? 1;
  check.invalidIf(!(share > 0 && share <= 1), 'ownershipShareOutOfRange');
}

// ============================================================================
// ΚΟΙΝΟΙ ΣΥΝΤΕΛΕΣΤΕΣ
// ============================================================================

export function factor(key: AppliedFactor['key'], value: number, ref: string, level?: number): AppliedFactor {
  return level === undefined ? { key, factor: value, ref } : { key, factor: value, ref, level };
}

interface ConstructionTable {
  readonly frame: number;
  readonly masonry: number;
  readonly makeshift: number;
  readonly lightRoof: number;
}

/** Ένας από τους τρεις τρόπους κατασκευής + **πρόσθετα** η ελαφριά στέγη. Μόνο ό,τι διαφέρει από το 1. */
export function constructionFactors(
  table: ConstructionTable,
  input: { construction?: ConstructionKind; lightRoof?: boolean },
  ref: string,
): AppliedFactor[] {
  const out: AppliedFactor[] = [];
  const kind = input.construction ?? 'frame';
  if (table[kind] !== 1) out.push(factor('construction', table[kind], ref));
  if (input.lightRoof === true) out.push(factor('lightRoof', table.lightRoof, ref));
  return out;
}

/**
 * Συνιδιοκτησία · διατηρητέο (υπερισχύει) / απαλλοτριωτέο — ίδιοι στα έντυπα 1, 4, 5. Οι πέτρινοι τοίχοι μόνο όπου
 * τους προβλέπει το έντυπο (`refs.walls`): η θέση στάθμευσης (άρθ. 7) **δεν** τους έχει.
 */
export function ownershipFactors(
  input: { coOwned?: boolean; encumbrance?: 'none' | 'listed' | 'expropriated'; thickWalls?: boolean },
  refs: { walls?: string; encumbrance: string; coOwnership: string },
): AppliedFactor[] {
  const out: AppliedFactor[] = [];
  if (refs.walls !== undefined && input.thickWalls === true) out.push(factor('thickWalls', THICK_WALLS_FACTOR, refs.walls));
  if (input.encumbrance === 'listed') out.push(factor('encumbrance', LISTED_FACTOR, refs.encumbrance));
  if (input.encumbrance === 'expropriated') out.push(factor('encumbrance', EXPROPRIATED_FACTOR, refs.encumbrance));
  if (input.coOwned === true) out.push(factor('coOwnership', CO_OWNERSHIP_FACTOR, refs.coOwnership));
  return out;
}

export function productOf(factors: readonly AppliedFactor[]): number {
  return factors.reduce((acc, f) => acc * f.factor, 1);
}

/**
 * Τελικό ποσό: αξία πριν τις ζημιές → συντελεστής ειδικών συνθηκών `1 − δαπάνη / αξία` (άρθ. 2 §23, ποτέ κάτω από
 * το 0) → ποσοστό κυριότητας → στρογγύλευση σε λεπτά.
 */
export function finalise(
  form: ObjectiveValueForm,
  base: { zonePrice: number; area: number; gross: number; factors: AppliedFactor[] },
  input: { damageRestorationCost?: number; ownershipShare?: number },
): ObjectiveValueResult {
  const factors = [...base.factors];
  let value = base.gross;
  const cost = input.damageRestorationCost ?? 0;
  if (cost > 0 && value > 0) {
    const damage = Math.max(0, 1 - cost / value);
    factors.push(factor('damage', damage, `${POL_1149} άρθ.2 §23`));
    value *= damage;
  }
  const share = input.ownershipShare ?? 1;
  if (share !== 1) {
    factors.push(factor('ownershipShare', share, `${POL_1149} άρθ.3 §1`));
    value *= share;
  }
  return { kind: 'computed', form, value: Math.round(value * 100) / 100, zonePrice: base.zonePrice, area: base.area, factors };
}
