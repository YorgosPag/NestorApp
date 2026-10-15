/**
 * @fileoverview Πίνακας αποσβέσεων παγίου (SSoT, καθαρές συναρτήσεις)
 * @description Η απόσβεση κάθε χρήσης ΠΑΡΑΓΕΤΑΙ από τα στοιχεία του παγίου (κόστος, υπολειμματική αξία, συντελεστής,
 *   ημερομηνίες). Το υπόλοιπο αρχής μιας χρήσης = άθροισμα των προηγούμενων χρήσεων του ΙΔΙΟΥ πίνακα.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-15, ADR-ACC-010 §2.1.1 Φάση 4): η μηχανή έπαιρνε το υπόλοιπο αρχής από το ΜΕΤΑΒΛΗΤΟ πεδίο
 *   `accumulatedDepreciation` του παγίου ⇒ δεύτερη εκτέλεση = διπλή απόσβεση, εκτέλεση παλιάς χρήσης μετά από νεότερη =
 *   λάθος ποσά, πάγιο καταχωρημένο αργά (κτήση 2021, καταχώριση 2026) = απόσβεση σαν να ήταν καινούργιο.
 *   Εδώ το ίδιο πάγιο και η ίδια χρήση δίνουν ΠΑΝΤΑ το ίδιο ποσό — ανεξάρτητα από σειρά και επαναλήψεις
 *   (SAP: planned depreciation από τα στοιχεία του παγίου).
 *
 * Σύμβαση περιόδου: `DEPRECIATION_PERIOD_CONTROL` (`config/depreciation-config.ts`).
 *
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { isDateKey } from '@/lib/calendar/date-key';

import type { FixedAsset } from '../../types/assets';
import { roundToTwo } from '../../utils/math';
import { DEPRECIATION_PERIOD_CONTROL } from '../config/depreciation-config';

/** Τα στοιχεία του παγίου από τα οποία παράγεται ο πίνακας — τίποτε μεταβλητό. */
export type DepreciationTerms = Pick<
  FixedAsset,
  'acquisitionCost' | 'residualValue' | 'depreciationRate' | 'depreciationStartDate' | 'disposalDate'
>;

/** Μία γραμμή του πίνακα αποσβέσεων. */
export interface DepreciationYear {
  readonly fiscalYear: number;
  /** Μήνες απόσβεσης μέσα στη χρήση (0–12). */
  readonly monthsApplied: number;
  readonly openingAccumulated: number;
  /** Η απόσβεση της χρήσης. */
  readonly charge: number;
  readonly closingAccumulated: number;
  readonly closingNetBookValue: number;
}

/** Τα στοιχεία του παγίου δεν επιτρέπουν υπολογισμό — ποτέ σιωπηλό «0». */
export class InvalidDepreciationTermsError extends Error {
  constructor(readonly field: keyof DepreciationTerms, readonly value: unknown) {
    super(`Invalid depreciation terms: ${String(field)}=${JSON.stringify(value)}`);
    this.name = 'InvalidDepreciationTermsError';
  }
}

const MONTHS_PER_YEAR = 12;

/** `YYYY-MM-DD` (ή πλήρες ISO με αυτή την ημέρα) ⇒ αύξων αριθμός μήνα `έτος × 12 + (μήνας − 1)`. */
function monthIndexOf(field: 'depreciationStartDate' | 'disposalDate', value: string): number {
  const day = value.substring(0, 10);
  if (!isDateKey(day)) throw new InvalidDepreciationTermsError(field, value);
  return Number(day.substring(0, 4)) * MONTHS_PER_YEAR + Number(day.substring(5, 7)) - 1;
}

/** Ο πρώτος μήνας απόσβεσης — ΚΦΕ αρ.24 παρ.6: ο ΕΠΟΜΕΝΟΣ της έναρξης χρήσης. */
function firstDepreciationMonth(terms: DepreciationTerms): number {
  const start = monthIndexOf('depreciationStartDate', terms.depreciationStartDate);
  return DEPRECIATION_PERIOD_CONTROL.acquisition === 'following_month' ? start + 1 : start;
}

/** Ο τελευταίος μήνας απόσβεσης — ο μήνας της εκποίησης (μετρά), αλλιώς ανοιχτό. */
function lastDepreciationMonth(terms: DepreciationTerms): number {
  if (terms.disposalDate === null) return Number.POSITIVE_INFINITY;
  const disposal = monthIndexOf('disposalDate', terms.disposalDate);
  return DEPRECIATION_PERIOD_CONTROL.disposal === 'through_month' ? disposal : disposal - 1;
}

/** Η αποσβέσιμη αξία, αφού ελεγχθούν τα ποσά. */
function depreciableBaseOf(terms: DepreciationTerms): number {
  const { acquisitionCost, residualValue, depreciationRate } = terms;
  if (!Number.isFinite(acquisitionCost) || acquisitionCost <= 0) {
    throw new InvalidDepreciationTermsError('acquisitionCost', acquisitionCost);
  }
  if (!Number.isFinite(residualValue) || residualValue < 0 || residualValue > acquisitionCost) {
    throw new InvalidDepreciationTermsError('residualValue', residualValue);
  }
  if (!Number.isFinite(depreciationRate) || depreciationRate <= 0 || depreciationRate > 100) {
    throw new InvalidDepreciationTermsError('depreciationRate', depreciationRate);
  }
  return roundToTwo(acquisitionCost - residualValue);
}

/** Μήνες απόσβεσης του παγίου μέσα στη χρήση (0–12). */
export function monthsInFiscalYear(terms: DepreciationTerms, fiscalYear: number): number {
  const from = Math.max(firstDepreciationMonth(terms), fiscalYear * MONTHS_PER_YEAR);
  const to = Math.min(lastDepreciationMonth(terms), fiscalYear * MONTHS_PER_YEAR + MONTHS_PER_YEAR - 1);
  return Math.max(0, to - from + 1);
}

/**
 * Ο πίνακας από την πρώτη χρήση απόσβεσης ως και την `throughYear`. Κενός αν η `throughYear` προηγείται.
 * Μετά την πλήρη απόσβεση ή την εκποίηση οι γραμμές έχουν απόσβεση 0.
 */
export function depreciationScheduleThrough(terms: DepreciationTerms, throughYear: number): DepreciationYear[] {
  const base = depreciableBaseOf(terms);
  const firstYear = Math.floor(firstDepreciationMonth(terms) / MONTHS_PER_YEAR);
  const rows: DepreciationYear[] = [];
  let accumulated = 0;
  for (let year = firstYear; year <= throughYear; year += 1) {
    const monthsApplied = monthsInFiscalYear(terms, year);
    const uncapped = roundToTwo(base * (terms.depreciationRate / 100) * (monthsApplied / MONTHS_PER_YEAR));
    const charge = roundToTwo(Math.max(0, Math.min(uncapped, roundToTwo(base - accumulated))));
    const closingAccumulated = roundToTwo(accumulated + charge);
    rows.push({
      fiscalYear: year,
      monthsApplied,
      openingAccumulated: accumulated,
      charge,
      closingAccumulated,
      closingNetBookValue: roundToTwo(terms.acquisitionCost - closingAccumulated),
    });
    accumulated = closingAccumulated;
  }
  return rows;
}

/** Η γραμμή μιας χρήσης. Πριν από την πρώτη χρήση απόσβεσης: μηδενική γραμμή. */
export function depreciationForYear(terms: DepreciationTerms, fiscalYear: number): DepreciationYear {
  const rows = depreciationScheduleThrough(terms, fiscalYear);
  const row = rows[rows.length - 1];
  if (row !== undefined) return row;
  // Τα ποσά τα έλεγξε ήδη ο `depreciationScheduleThrough`: άκυρο πάγιο δεν γίνεται «0» επειδή είναι νωρίς.
  return {
    fiscalYear,
    monthsApplied: 0,
    openingAccumulated: 0,
    charge: 0,
    closingAccumulated: 0,
    closingNetBookValue: roundToTwo(terms.acquisitionCost),
  };
}

/** Πλήρως αποσβεσμένο στο τέλος της γραμμής; (αποσβέσιμη αξία εξαντλήθηκε) */
export function isFullyDepreciatedAt(terms: DepreciationTerms, row: DepreciationYear): boolean {
  return row.closingAccumulated >= depreciableBaseOf(terms);
}
