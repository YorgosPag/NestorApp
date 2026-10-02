/**
 * @fileoverview **Έντυπο 1 — κατοικία ή διαμέρισμα** (ΠΟΛ.1149/1994 άρθρο 3).
 * @related ADR-898 · `objective-value-tables.ts` · `objective-value-common.ts`
 * @module lib/objective-value/objective-value-residence
 *
 * 🔑 **Πολυώροφη κατοικία** (μεζονέτα, άρθ. 3 §6β · 15 §1β): κάθε επίπεδο υπολογίζεται **χωριστά** με τον δικό του
 * συντελεστή ορόφου, αλλά ο συντελεστής επιφάνειας είναι **ενιαίος**, από το **άθροισμα** των επιφανειών.
 *
 * 🔑 **Ο ΣΕ ζητείται μόνο αν αλλάζει το αποτέλεσμα**: στον πίνακα του άρθ. 3 §4 το υπόγειο και οι όροφοι από τον Δ'
 * και πάνω έχουν **ίδιο** συντελεστή σε όλα τα κλιμάκια ΣΕ. Σε ρετιρέ Ε' ορόφου ο ΣΕ είναι άσχετος — δεν τον ζητάμε.
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
  COMPLETION_SAO_LIMITS,
  ELEVATOR_FROM_FLOOR,
  MIXED_AREA_FACTOR,
  NO_CENTRAL_HEATING_FACTOR,
  NO_ELEVATOR_FACTOR,
  RESIDENCE_AGE_BANDS,
  RESIDENCE_AREA_BANDS,
  RESIDENCE_COMPLETION,
  RESIDENCE_CONSTRUCTION,
  RESIDENCE_FLOOR_BY_SE,
  RESIDENCE_FRONTAGE,
} from './objective-value-tables';
import type { AppliedFactor, ObjectiveValueResult, ResidenceInput } from './objective-value-types';

const ART3 = `${POL_1149} άρθ.3`;

/** Θέση στη γραμμή του πίνακα ορόφου: υπόγειο 0, ισόγειο 1, Α' 2, … ΣΤ' και πάνω 7. */
function floorColumn(floor: number): number {
  return floor < 0 ? 0 : Math.min(floor + 1, 7);
}

/** Ο ΣΕ αλλάζει τον συντελεστή μόνο από το ισόγειο ως τον Γ' όροφο. */
function floorNeedsCommerciality(floor: number): boolean {
  const column = floorColumn(floor);
  return RESIDENCE_FLOOR_BY_SE.some((row) => row.floors[column] !== RESIDENCE_FLOOR_BY_SE[0].floors[column]);
}

function floorFactor(floor: number, se: number | null): number {
  const row = se === null ? RESIDENCE_FLOOR_BY_SE[0] : RESIDENCE_FLOOR_BY_SE.find((r) => se < r.seBelow);
  return (row ?? RESIDENCE_FLOOR_BY_SE[RESIDENCE_FLOOR_BY_SE.length - 1]).floors[floorColumn(floor)];
}

interface ResolvedLevel {
  readonly floor: number;
  readonly area: number;
}

/** Ελέγχει την είσοδο και επιστρέφει τα επίπεδα με **γνωστό** όροφο και επιφάνεια (ό,τι λείπει, καταγράφεται). */
function checkResidence(check: InputCheck, input: ResidenceInput): ResolvedLevel[] {
  checkCommon(check, input);
  check.invalidIf(input.levels.length === 0, 'noLevels');
  const resolved: ResolvedLevel[] = [];
  for (const level of input.levels) {
    const area = check.need(level.area, 'area');
    check.invalidIf(area !== null && !(area > 0), 'nonPositiveArea');
    const floor = check.need(level.floor, 'floor');
    if (floor === null) continue;
    if (floorNeedsCommerciality(floor)) check.need(input.commercialityFactor, 'commercialityFactor');
    if (floor >= ELEVATOR_FROM_FLOOR) check.need(input.hasElevator, 'hasElevator');
    check.invalidIf(input.completion === 'foundation' && floor > 0, 'foundationStageAboveGround');
    if (area !== null) resolved.push({ floor, area });
  }
  checkUnitWide(check, input);
  return resolved;
}

function checkUnitWide(check: InputCheck, input: ResidenceInput): void {
  check.need(input.frontage, 'frontage');
  check.need(input.hasCentralHeating, 'hasCentralHeating');
  // `null` = στάδιο άγνωστο (ADR-898 Φ4): ζητείται το ίδιο — παλαιότητα και ΣΑΟ εξαρτώνται από αυτό.
  const completion = input.completion === undefined ? 'complete' : check.need(input.completion, 'completion');
  if (completion === 'complete') check.need(input.ageYears, 'ageYears');
  else if (completion !== null) check.need(input.plotUtilisation, 'plotUtilisation');
}

/** Πρόσοψη (§3): οι περιπτώσεις β, γ δεν ισχύουν σε μνημονευόμενους οικισμούς ούτε σε απαλλοτριωτέα. */
function frontageFactor(input: ResidenceInput): AppliedFactor[] {
  const frontage = input.frontage ?? 'single';
  const exempt = input.frontageExemptSettlement === true || input.encumbrance === 'expropriated';
  if (exempt && (frontage === 'multiple' || frontage === 'narrow')) return [];
  const value = RESIDENCE_FRONTAGE[frontage];
  return value === 1 ? [] : [factor('frontage', value, `${ART3} §3`)];
}

/** Παλαιότητα μόνο σε πλήρως αποπερατωμένο (άρθ. 2 §20)· αλλιώς συντελεστής αποπεράτωσης ανά ΣΑΟ (§9). */
function stageFactor(input: ResidenceInput): AppliedFactor[] {
  const completion = input.completion ?? 'complete'; // `null` δεν φτάνει εδώ: το έκοψε ο έλεγχος
  if (completion === 'complete') {
    const age = bandFactor(RESIDENCE_AGE_BANDS, input.ageYears ?? 0);
    return age === 1 ? [] : [factor('age', age, `${ART3} §7`)];
  }
  const sao = input.plotUtilisation ?? 0;
  const column = sao <= COMPLETION_SAO_LIMITS[0] ? 0 : sao <= COMPLETION_SAO_LIMITS[1] ? 1 : 2;
  return [factor('completion', RESIDENCE_COMPLETION[completion][column], `${ART3} §9`)];
}

/** Οι συντελεστές που ισχύουν για **όλα** τα επίπεδα. */
function wholeUnitFactors(input: ResidenceInput, totalArea: number): AppliedFactor[] {
  const mixed = input.areaIncludesCommon === true;
  const out: AppliedFactor[] = [];
  if (mixed) out.push(factor('mixedArea', MIXED_AREA_FACTOR, `${POL_1149} άρθ.2 §17`));
  const area = bandFactor(RESIDENCE_AREA_BANDS, mixed ? totalArea * MIXED_AREA_FACTOR : totalArea);
  if (area !== 1) out.push(factor('area', area, `${ART3} §6`));
  out.push(...frontageFactor(input), ...stageFactor(input));
  out.push(...constructionFactors(RESIDENCE_CONSTRUCTION, input, `${ART3} §10`));
  if (input.hasCentralHeating === false) out.push(factor('centralHeating', NO_CENTRAL_HEATING_FACTOR, `${ART3} §11α`));
  out.push(...ownershipFactors(input, { walls: `${ART3} §5`, encumbrance: `${ART3} §8`, coOwnership: `${ART3} §12` }));
  return out;
}

/** Ο όροφος (και ο ανελκυστήρας πάνω από τον Β') — ανά επίπεδο. */
function levelFactors(input: ResidenceInput, floor: number, index: number): AppliedFactor[] {
  const multi = input.levels.length > 1 ? index : undefined;
  const out = [factor('floor', floorFactor(floor, input.commercialityFactor ?? null), `${ART3} §4`, multi)];
  if (floor >= ELEVATOR_FROM_FLOOR && input.hasElevator === false) {
    out.push(factor('elevator', NO_ELEVATOR_FACTOR, `${ART3} §11β`, multi));
  }
  return out;
}

export function computeResidence(input: ResidenceInput): ObjectiveValueResult {
  const check = new InputCheck();
  const levels = checkResidence(check, input);
  const blocked = check.blocked('residence');
  if (blocked !== null || input.zonePrice === null) return blocked ?? { kind: 'needsInput', form: 'residence', missing: ['zonePrice'] };

  const zonePrice = input.zonePrice;
  const totalArea = levels.reduce((sum, level) => sum + level.area, 0);
  const shared = wholeUnitFactors(input, totalArea);
  const perLevel = levels.map((level, index) => levelFactors(input, level.floor, index));
  const levelSum = levels.reduce((sum, level, index) => sum + zonePrice * level.area * productOf(perLevel[index]), 0);
  const gross = levelSum * productOf(shared);
  return finalise('residence', { zonePrice, area: totalArea, gross, factors: [...perLevel.flat(), ...shared] }, input);
}
