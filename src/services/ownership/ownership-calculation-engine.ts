/**
 * ============================================================================
 * ADR-235: Ownership Calculation Engine
 * ============================================================================
 *
 * Υπολογισμός χιλιοστών συνιδιοκτησίας με 3 μεθόδους:
 * - Μέθοδος Α: Κατ' Εμβαδόν (Αναλογική)
 * - Μέθοδος Β: Κατ' Αντικειμενική Αξία (Σταθμισμένη, ΠΟΛ 1149/1994)
 * - Μέθοδος Γ: Κατ' Όγκον
 *
 * Rounding: Largest Remainder Method (Hamilton) → ΠΑΝΤΑ σύνολο = 1000
 *
 * @module services/ownership/ownership-calculation-engine
 */

import type {
  OwnershipTableRow,
  MutableOwnershipTableRow,
  CalculationCoefficients,
  FloorCoefficientTable,
  OwnershipValidationResult,
  BartexSummary,
  LandownerEntry,
  CategorySummary,
} from '@/types/ownership-table';
import {
  FLOOR_COEFFICIENTS_TABLE_A,
  FLOOR_COEFFICIENTS_TABLE_B,
  FLOOR_TO_COEFFICIENT_KEY,
  TOTAL_SHARES_TARGET,
  MIN_SHARES_PER_ROW,
} from '@/types/ownership-table';

// ============================================================================
// FLOOR COEFFICIENT RESOLUTION
// ============================================================================

/**
 * Resolve floor coefficient table based on commerciality coefficient (ΣΕ)
 */
function getFloorCoefficientTable(commercialityCoefficient: number): FloorCoefficientTable {
  return commercialityCoefficient >= 1.5
    ? FLOOR_COEFFICIENTS_TABLE_B
    : FLOOR_COEFFICIENTS_TABLE_A;
}

/**
 * Get floor coefficient for a specific floor string
 */
function getFloorCoefficient(
  floor: string,
  table: FloorCoefficientTable,
): number {
  const normalized = floor.toLowerCase().trim();
  const key = FLOOR_TO_COEFFICIENT_KEY[normalized];

  if (key) {
    return table[key] ?? 1.0;
  }

  // Parse numeric floor
  const floorNum = parseInt(normalized, 10);
  if (!isNaN(floorNum)) {
    if (floorNum < 0) return table.basement;
    if (floorNum === 0) return table.ground;
    if (floorNum === 1) return table.first;
    if (floorNum === 2) return table.second;
    if (floorNum === 3) return table.third;
    if (floorNum === 4) return table.fourth;
    if (floorNum >= 6 && table.sixthPlus !== undefined) return table.sixthPlus;
    if (floorNum >= 5) return table.fifthPlus;
  }

  // Default: 1st floor coefficient
  return table.first;
}

// ============================================================================
// LARGEST REMAINDER METHOD (Hamilton)
// ============================================================================

/**
 * Largest Remainder Method — Εγγυάται σύνολο = target (1000)
 *
 * 1. Υπολόγισε raw shares (δεκαδικά)
 * 2. Floor κάθε share
 * 3. Κατάνειμε τα υπόλοιπα στις γραμμές με το μεγαλύτερο δεκαδικό υπόλοιπο
 */
export function roundWithLargestRemainder(
  rawShares: ReadonlyArray<number>,
  target: number = TOTAL_SHARES_TARGET,
): number[] {
  if (rawShares.length === 0) return [];

  const totalRaw = rawShares.reduce((sum, s) => sum + s, 0);
  if (totalRaw === 0) {
    // Distribute equally
    const base = Math.floor(target / rawShares.length);
    const remainder = target - base * rawShares.length;
    return rawShares.map((_, i) => base + (i < remainder ? 1 : 0));
  }

  // Scale to target
  const scaled = rawShares.map(s => (s / totalRaw) * target);

  // Floor each
  const floored = scaled.map(s => Math.floor(s));

  // Calculate remainders
  const remainders = scaled.map((s, i) => ({
    index: i,
    remainder: s - floored[i],
  }));

  // How many extra units to distribute
  const currentTotal = floored.reduce((sum, s) => sum + s, 0);
  let toDistribute = target - currentTotal;

  // Sort by remainder descending
  remainders.sort((a, b) => b.remainder - a.remainder);

  // Distribute
  for (const entry of remainders) {
    if (toDistribute <= 0) break;
    floored[entry.index] += 1;
    toDistribute -= 1;
  }

  // Ensure minimum shares
  const result = floored.map(s => Math.max(s, MIN_SHARES_PER_ROW));

  // If enforcing minimums pushed total over, reduce from largest
  let total = result.reduce((sum, s) => sum + s, 0);
  if (total > target) {
    const sorted = result
      .map((s, i) => ({ index: i, shares: s }))
      .sort((a, b) => b.shares - a.shares);

    for (const entry of sorted) {
      if (total <= target) break;
      const reduction = Math.min(entry.shares - MIN_SHARES_PER_ROW, total - target);
      result[entry.index] -= reduction;
      total -= reduction;
    }
  }

  return result;
}

// ============================================================================
// CALCULATION METHODS
// ============================================================================

/**
 * Split rows into participating (in calculation) and non-participating (informational).
 * Non-participating rows keep millesimalShares: 0.
 */
function splitByParticipation(
  rows: ReadonlyArray<MutableOwnershipTableRow>,
): { participating: MutableOwnershipTableRow[]; indices: number[] } {
  const participating: MutableOwnershipTableRow[] = [];
  const indices: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].participatesInCalculation !== false) {
      participating.push(rows[i]);
      indices.push(i);
    }
  }

  return { participating, indices };
}

/**
 * Apply calculated shares to participating rows, keep non-participating at 0.
 */
function mergeCalculatedShares(
  rows: ReadonlyArray<MutableOwnershipTableRow>,
  shares: number[],
  indices: number[],
  coefficientsMap?: Map<number, { floorCoefficient: number; valueCoefficient: number }>,
): MutableOwnershipTableRow[] {
  const result = rows.map(row => ({
    ...row,
    millesimalShares: row.participatesInCalculation !== false ? row.millesimalShares : 0,
    isManualOverride: false,
    coefficients: coefficientsMap ? null : row.coefficients,
  }));

  for (let j = 0; j < indices.length; j++) {
    const idx = indices[j];
    result[idx] = {
      ...result[idx],
      millesimalShares: shares[j],
      isManualOverride: false,
      coefficients: coefficientsMap?.get(j) ?? null,
    };
  }

  return result;
}

/**
 * Μέθοδος Α: Κατ' Εμβαδόν — shares_i = (area_i / totalArea) × 1000
 */
export function calculateByArea(
  rows: ReadonlyArray<MutableOwnershipTableRow>,
): MutableOwnershipTableRow[] {
  const { participating, indices } = splitByParticipation(rows);
  const rawShares = participating.map(row => row.areaSqm);
  const shares = roundWithLargestRemainder(rawShares);

  return mergeCalculatedShares(rows, shares, indices);
}

/**
 * Μέθοδος Β: Κατ' Αντικειμενική Αξία
 * shares_i = (area_i × zonePrice × floorCoeff × valueCoeff / totalValue) × 1000
 */
export function calculateByValue(
  rows: ReadonlyArray<MutableOwnershipTableRow>,
  zonePrice: number,
  commercialityCoefficient: number,
): MutableOwnershipTableRow[] {
  const { participating, indices } = splitByParticipation(rows);
  const coeffTable = getFloorCoefficientTable(commercialityCoefficient);

  const coefficientsMap = new Map<number, CalculationCoefficients>();
  const rawShares: number[] = [];

  for (let j = 0; j < participating.length; j++) {
    const row = participating[j];
    const floorCoeff = getFloorCoefficient(row.floor, coeffTable);
    const valueCoeff = row.coefficients?.valueCoefficient ?? 1.0;

    coefficientsMap.set(j, { floorCoefficient: floorCoeff, valueCoefficient: valueCoeff });
    rawShares.push(row.areaSqm * zonePrice * floorCoeff * valueCoeff);
  }

  const shares = roundWithLargestRemainder(rawShares);

  return mergeCalculatedShares(rows, shares, indices, coefficientsMap);
}

/**
 * Μέθοδος Γ: Κατ' Όγκον — shares_i = (area_i × height_i / totalVolume) × 1000
 */
export function calculateByVolume(
  rows: ReadonlyArray<MutableOwnershipTableRow>,
): MutableOwnershipTableRow[] {
  const { participating, indices } = splitByParticipation(rows);
  const rawShares = participating.map(row => {
    const height = row.heightM ?? 3.0; // Default floor height: 3m
    return row.areaSqm * height;
  });
  const shares = roundWithLargestRemainder(rawShares);

  return mergeCalculatedShares(rows, shares, indices);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that total shares = 1000 and all participating rows have valid shares.
 * Non-participating rows (participatesInCalculation === false) are excluded.
 */
export function validateTotal(
  rows: ReadonlyArray<Pick<OwnershipTableRow, 'millesimalShares' | 'ordinal' | 'entityCode' | 'participatesInCalculation'>>,
): OwnershipValidationResult {
  const errors: string[] = [];
  const participating = rows.filter(r => r.participatesInCalculation !== false);
  const total = participating.reduce((sum, row) => sum + row.millesimalShares, 0);

  if (total !== TOTAL_SHARES_TARGET) {
    errors.push(
      `Σύνολο χιλιοστών = ${total}‰ (πρέπει ${TOTAL_SHARES_TARGET}‰, διαφορά: ${total - TOTAL_SHARES_TARGET}‰)`,
    );
  }

  for (const row of participating) {
    if (row.millesimalShares < MIN_SHARES_PER_ROW) {
      errors.push(
        `Γραμμή ${row.ordinal} (${row.entityCode}): ${row.millesimalShares}‰ < ${MIN_SHARES_PER_ROW}‰ (ελάχιστο)`,
      );
    }
    if (!Number.isInteger(row.millesimalShares)) {
      errors.push(
        `Γραμμή ${row.ordinal} (${row.entityCode}): ${row.millesimalShares}‰ δεν είναι ακέραιος`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    total,
    difference: total - TOTAL_SHARES_TARGET,
    errors,
  };
}

// ============================================================================
// SUMMARY CALCULATIONS
// ============================================================================

/**
 * Calculate category summary from rows.
 * Only participating rows count towards shares totals.
 */
export function calculateCategorySummary(
  rows: ReadonlyArray<Pick<OwnershipTableRow, 'category' | 'millesimalShares' | 'participatesInCalculation'>>,
): { main: CategorySummary; auxiliary: CategorySummary } {
  let mainCount = 0;
  let mainShares = 0;
  let auxCount = 0;
  let auxShares = 0;

  for (const row of rows) {
    if (row.participatesInCalculation === false) continue;
    if (row.category === 'main') {
      mainCount++;
      mainShares += row.millesimalShares;
    } else {
      auxCount++;
      auxShares += row.millesimalShares;
    }
  }

  return {
    main: { count: mainCount, shares: mainShares },
    auxiliary: { count: auxCount, shares: auxShares },
  };
}

/**
 * Calculate bartex summary from rows
 */
export function calculateBartexSummary(
  rows: ReadonlyArray<Pick<OwnershipTableRow, 'ownerParty' | 'millesimalShares'>>,
  landowners: ReadonlyArray<LandownerEntry>,
  bartexPercentage: number,
): BartexSummary {
  let contractorShares = 0;
  let contractorCount = 0;
  let landownerShares = 0;
  let landownerCount = 0;

  for (const row of rows) {
    if (row.ownerParty === 'contractor') {
      contractorShares += row.millesimalShares;
      contractorCount++;
    } else if (row.ownerParty === 'landowner') {
      landownerShares += row.millesimalShares;
      landownerCount++;
    }
  }

  return {
    bartexPercentage,
    contractorShares,
    totalLandownerShares: landownerShares,
    contractorPropertyCount: contractorCount,
    landownerPropertyCount: landownerCount,
    landowners: [...landowners],
  };
}
