/**
 * @fileoverview **Έντυπα 4 + 5 — αποθήκη και θέση στάθμευσης** (ΠΟΛ.1149/1994 άρθρα 6, 7): τα «παρακολουθήματα».
 * @related ADR-898 · `objective-value-tables.ts` · `objective-value-common.ts`
 * @module lib/objective-value/objective-value-ancillary
 *
 * 🔑 Τα δύο έντυπα έχουν **ίδιο** πίνακα παλαιότητας και αποπεράτωσης, αλλά **διαφορετικό** πίνακα κατασκευής
 * (πρόχειρο 0,70 vs 0,80 · στέγη 0,80 vs 0,90) ⇒ κοινή διαδρομή, πίνακας ως όρισμα.
 *
 * 🔑 **Ανοιχτή θέση στάθμευσης** (ακάλυπτος, ασκεπές δώμα, πυλωτή): **μόνο** συντελεστής θέσης — καμία παλαιότητα,
 * αποπεράτωση ή κατασκευή (άρθ. 7 §6, §8, §9 τα περιορίζουν ρητά σε **κλειστή** θέση), και **χωρίς** ΣΕ.
 *
 * ⚠️ **ΣΕ αποθήκης / στάθμευσης = ο ΜΙΚΡΟΤΕΡΟΣ** των δρόμων του οικοπέδου (άρθ. 6 §3β · 7 §3β) — αντίθετα με την
 * επαγγελματική στέγη. Η μηχανή παίρνει τον ΣΕ έτοιμο· τον κανόνα τον εφαρμόζει όποιος ξέρει τους δρόμους.
 */

import {
  bandFactor,
  checkCommon,
  constructionFactors,
  factor,
  finalise,
  InputCheck,
  ownershipFactors,
  POL_1149,
  productOf,
} from './objective-value-common';
import {
  ANCILLARY_AGE_BANDS,
  ANCILLARY_COMPLETION,
  PARKING_CLOSED_BY_SE,
  PARKING_CONSTRUCTION,
  PARKING_DEFAULT_AREA_M2,
  PARKING_OPEN,
  STORAGE_CONSTRUCTION,
  STORAGE_POSITION,
} from './objective-value-tables';
import type {
  AncillaryCompletion,
  AppliedFactor,
  ObjectiveValueResult,
  ParkingInput,
  ParkingPosition,
  StorageInput,
} from './objective-value-types';

const ART6 = `${POL_1149} άρθ.6`;
const ART7 = `${POL_1149} άρθ.7`;

/** Παλαιότητα σε πλήρως αποπερατωμένο, αλλιώς συντελεστής σταδίου — κοινό στα έντυπα 4 και 5. */
function stageFactor(completion: AncillaryCompletion, ageYears: number, article: string): AppliedFactor[] {
  if (completion === 'complete') {
    const age = bandFactor(ANCILLARY_AGE_BANDS, ageYears);
    return age === 1 ? [] : [factor('age', age, `${article} §6`)];
  }
  return [factor('completion', ANCILLARY_COMPLETION[completion], `${article} §8`)];
}

// ============================================================================
// ΑΠΟΘΗΚΗ (έντυπο 4)
// ============================================================================

function checkStorage(check: InputCheck, input: StorageInput): void {
  checkCommon(check, input);
  const area = check.need(input.area, 'area');
  check.invalidIf(area !== null && !(area > 0), 'nonPositiveArea');
  const position = check.need(input.position, 'position');
  if (position !== null && STORAGE_POSITION[position].perSe) check.need(input.commercialityFactor, 'commercialityFactor');
  if ((input.completion ?? 'complete') === 'complete') check.need(input.ageYears, 'ageYears');
}

export function computeStorage(input: StorageInput): ObjectiveValueResult {
  const check = new InputCheck();
  checkStorage(check, input);
  const blocked = check.blocked('storage');
  if (blocked !== null || input.zonePrice === null || input.area === null || input.position === null) {
    return blocked ?? { kind: 'needsInput', form: 'storage', missing: ['zonePrice'] };
  }
  const rule = STORAGE_POSITION[input.position];
  const position = rule.perSe ? rule.factor * (input.commercialityFactor ?? 1) : rule.factor;
  const factors: AppliedFactor[] = [
    factor('position', position, `${ART6} §4`),
    ...stageFactor(input.completion ?? 'complete', input.ageYears ?? 0, ART6),
    ...constructionFactors(STORAGE_CONSTRUCTION, input, `${ART6} §9`),
    ...ownershipFactors(input, { walls: `${ART6} §5`, encumbrance: `${ART6} §7`, coOwnership: `${ART6} §10` }),
  ];
  const gross = input.zonePrice * input.area * productOf(factors);
  return finalise('storage', { zonePrice: input.zonePrice, area: input.area, gross, factors }, input);
}

// ============================================================================
// ΘΕΣΗ ΣΤΑΘΜΕΥΣΗΣ (έντυπο 5)
// ============================================================================

const CLOSED_LEVEL: Partial<Record<ParkingPosition, 0 | 1 | 2>> = { closedBasement: 0, closedGround: 1, closedUpper: 2 };

function isClosed(position: ParkingPosition): boolean {
  return CLOSED_LEVEL[position] !== undefined;
}

function parkingPositionFactor(position: ParkingPosition, se: number): number {
  const level = CLOSED_LEVEL[position];
  if (level === undefined) return position === 'pilotis' ? PARKING_OPEN.pilotis : PARKING_OPEN.yardOrRoof;
  const row = PARKING_CLOSED_BY_SE.find((r) => se <= r.seUpTo) ?? PARKING_CLOSED_BY_SE[PARKING_CLOSED_BY_SE.length - 1];
  return row.levels[level];
}

function checkParking(check: InputCheck, input: ParkingInput): void {
  checkCommon(check, input);
  check.invalidIf(input.area !== null && !(input.area > 0), 'nonPositiveArea');
  const position = check.need(input.position, 'position');
  if (position === null || !isClosed(position)) return;
  check.need(input.commercialityFactor, 'commercialityFactor');
  if ((input.completion ?? 'complete') === 'complete') check.need(input.ageYears, 'ageYears');
}

/** Παλαιότητα, αποπεράτωση, κατασκευή: **μόνο** σε κλειστή θέση (άρθ. 7 §6, §8, §9). */
function closedParkingFactors(input: ParkingInput): AppliedFactor[] {
  return [
    ...stageFactor(input.completion ?? 'complete', input.ageYears ?? 0, ART7),
    ...constructionFactors(PARKING_CONSTRUCTION, input, `${ART7} §9`),
  ];
}

export function computeParking(input: ParkingInput): ObjectiveValueResult {
  const check = new InputCheck();
  checkParking(check, input);
  const blocked = check.blocked('parking');
  if (blocked !== null || input.zonePrice === null || input.position === null) {
    return blocked ?? { kind: 'needsInput', form: 'parking', missing: ['zonePrice'] };
  }
  const area = input.area ?? PARKING_DEFAULT_AREA_M2;
  const factors: AppliedFactor[] = [
    factor('position', parkingPositionFactor(input.position, input.commercialityFactor ?? 1), `${ART7} §4`),
    ...(isClosed(input.position) ? closedParkingFactors(input) : []),
    ...ownershipFactors(input, { encumbrance: `${ART7} §7`, coOwnership: `${ART7} §10` }),
  ];
  const gross = input.zonePrice * area * productOf(factors);
  return finalise('parking', { zonePrice: input.zonePrice, area, gross, factors }, input);
}
