/**
 * @fileoverview Αποσβέσεις → Βιβλίο Ε-Ε: η ΑΠΟΦΑΣΗ σύγκλισης (καθαρή, χωρίς I/O)
 * @description Για (πάγιο, χρήση): πόσο ΠΡΕΠΕΙ να είναι καταχωρημένο, πόσο ΕΙΝΑΙ, και ποια εγγραφή διαφοράς μπαίνει
 *   στο βιβλίο. Την εκτελεί ΕΝΑΣ γραφέας (`repository/accounting-repo-depreciation.ts`) μέσα σε μία συναλλαγή.
 *
 * 🔴 ΓΙΑΤΙ ΣΥΓΚΛΙΣΗ ΚΑΙ ΟΧΙ «ΓΡΑΨΕ ΜΙΑ ΦΟΡΑ» (2026-10-15, ADR-ACC-010 §2.1.1 Φάση 5):
 *   - SAP AFAB «repeat run»: διορθωμένα στοιχεία παγίου ⇒ η επανεκτέλεση περνά ΜΟΝΟ τη διαφορά — η παλιά εγγραφή
 *     δεν αλλάζει ποτέ (audit trail)·
 *   - Xero «rollback depreciation»: αναίρεση από τη ΝΕΟΤΕΡΗ χρήση προς τα πίσω.
 *   Και τα δύο είναι η ΙΔΙΑ πράξη: «φέρε το καταχωρημένο στο σωστό» (book) ή «στο 0» (reverse). Ένας κανόνας, ένας
 *   γραφέας — ίδια (πάγιο, χρήση) όσες φορές κι αν τρέξει = ίδιο βιβλίο, χωρίς διπλό έξοδο.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 5) · ADR-ACC-007 §5.1 / §10
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type {
  DepreciationAssetProjection,
  DepreciationDecision,
  DepreciationDecisionInput,
  DepreciationIntent,
  DepreciationJournalLine,
  DepreciationRecord,
  FixedAsset,
} from '../../types/assets';
import { getCategoryByCode } from '../../config/account-categories';
import { fiscalPeriodKey } from '../fiscal-period-keys';
import { nowISO } from '@/lib/date-local';
import { roundToTwo } from '../../utils/math';
import { depreciationForYear, isFullyDepreciatedAt, type DepreciationYear } from './depreciation-schedule';

/** Ο Δεκέμβριος — οι αποσβέσεις γράφονται στις 31/12 της χρήσης. */
const DEPRECIATION_PERIOD_NUMBER = 12;

/** Η περίοδος όπου γράφονται οι αποσβέσεις μιας χρήσης — Δεκέμβριος (εγγραφή 31/12, ADR-ACC-007 §5.1). */
export function depreciationPeriodIdFor(fiscalYear: number): string {
  return fiscalPeriodKey(fiscalYear, DEPRECIATION_PERIOD_NUMBER);
}

/**
 * Συμμετέχει το πάγιο στην εκτέλεση; Το `inactive` (εκτός εκμετάλλευσης) ΟΧΙ — ΠΟΛ 1073/2015: καμία απόσβεση για
 * όσο είναι εκτός εκμετάλλευσης. ⚠️ Δεν κρατάμε ΔΙΑΣΤΗΜΑΤΑ αδράνειας, άρα η κατάσταση ισχύει για όλη τη χρήση.
 */
export function participates(asset: FixedAsset): boolean {
  return asset.status !== 'inactive';
}

/** Το σωστό ποσό της χρήσης — 0 αν το πάγιο δεν συμμετέχει ή ο πίνακας δεν δίνει απόσβεση. */
export function depreciationTargetFor(asset: FixedAsset, fiscalYear: number): { readonly row: DepreciationYear; readonly target: number } {
  const row = depreciationForYear(asset, fiscalYear);
  return { row, target: participates(asset) && row.charge > 0 ? row.charge : 0 };
}

/** Οι χρήσεις με καταχωρημένη απόσβεση (πάγια πριν από τη Φάση 5: μόνο η νεότερη ήταν γνωστή). */
export function bookedYearsOf(asset: FixedAsset): number[] {
  if (asset.depreciatedFiscalYears) return [...asset.depreciatedFiscalYears];
  const last = asset.lastDepreciatedFiscalYear ?? null;
  return last === null ? [] : [last];
}

function withYear(years: readonly number[], fiscalYear: number, booked: boolean): number[] {
  const rest = years.filter((year) => year !== fiscalYear);
  return (booked ? [...rest, fiscalYear] : rest).sort((a, b) => a - b);
}

/**
 * Η προβολή του παγίου = το κλείσιμο της ΝΕΟΤΕΡΗΣ καταχωρημένης χρήσης, από τον πίνακα αποσβέσεων. Καμία καταχωρημένη
 * ⇒ η εικόνα του καινούργιου παγίου. Μόνο το `active` γίνεται `fully_depreciated` (και γυρίζει πίσω στην αναίρεση)·
 * ένα `disposed` / `inactive` μένει ό,τι ήταν.
 */
export function assetProjectionAt(asset: FixedAsset, years: readonly number[]): DepreciationAssetProjection {
  const latest = years.length === 0 ? null : Math.max(...years);
  const fully = latest !== null && isFullyDepreciatedAt(asset, depreciationForYear(asset, latest));
  const row = latest === null ? null : depreciationForYear(asset, latest);
  const status = asset.status === 'active' && fully ? 'fully_depreciated'
    : asset.status === 'fully_depreciated' && !fully ? 'active'
      : asset.status;
  return {
    accumulatedDepreciation: row?.closingAccumulated ?? 0,
    netBookValue: row?.closingNetBookValue ?? asset.acquisitionCost,
    status,
    fullyDepreciatedDate: fully ? `${latest}-12-31` : null,
    lastDepreciatedFiscalYear: latest,
    depreciatedFiscalYears: [...years],
  };
}

/** Η εγγραφή απόσβεσης για καταχωρημένο ποσό `amount` (0 = αναιρεμένη: κλείσιμο = άνοιγμα). */
export function depreciationRecordBodyOf(asset: FixedAsset, row: DepreciationYear, amount: number): Extract<DepreciationDecision, { kind: 'post' }>['record'] {
  const closingAccumulated = roundToTwo(row.openingAccumulated + amount);
  return {
    assetId: asset.assetId,
    fiscalYear: row.fiscalYear,
    acquisitionCost: asset.acquisitionCost,
    openingAccumulatedDepreciation: row.openingAccumulated,
    annualDepreciation: amount,
    closingAccumulatedDepreciation: closingAccumulated,
    closingNetBookValue: roundToTwo(asset.acquisitionCost - closingAccumulated),
    appliedRate: asset.depreciationRate,
    monthsApplied: amount > 0 ? row.monthsApplied : 0,
    calculatedAt: nowISO(),
  };
}

/**
 * Η εγγραφή Ε-Ε της διαφοράς — ADR-ACC-007 §5.1: έξοδο `depreciation` στις 31/12 της χρήσης, ΦΠΑ 0, κωδικοί myDATA /
 * Ε3 από το SSoT κατηγοριών (ποτέ γραμμένοι εδώ). Περιγραφή = το όνομα του παγίου (δεδομένο, όχι κείμενο κώδικα).
 */
export function depreciationJournalLineFor(asset: FixedAsset, fiscalYear: number, delta: number): DepreciationJournalLine {
  const category = getCategoryByCode('depreciation');
  if (!category) throw new Error('Account category "depreciation" is missing from the chart of accounts');
  return {
    date: `${fiscalYear}-12-31`,
    type: 'expense',
    category: 'depreciation',
    description: asset.description,
    netAmount: delta,
    vatRate: 0,
    vatAmount: 0,
    grossAmount: delta,
    vatDeductible: false,
    paymentMethod: 'non_cash',
    contactId: null,
    contactName: null,
    invoiceId: null,
    mydataCode: category.mydataCode,
    e3Code: category.e3Code,
    fiscalYear,
    quarter: 4, // 31/12 ⇒ Δ' τρίμηνο
    notes: null,
  };
}

/** Αναίρεση επιτρέπεται μόνο για τη ΝΕΟΤΕΡΗ καταχωρημένη χρήση — αλλιώς θα έμενε κενό στη σειρά (Xero rollback). */
function laterYearPosted(asset: FixedAsset, fiscalYear: number): boolean {
  return bookedYearsOf(asset).some((year) => year > fiscalYear);
}

/**
 * Η απόφαση για (πάγιο, χρήση): σύγκλιση του καταχωρημένου στο σωστό (`book`) ή στο 0 (`reverse`). Καθαρή — τρέχει
 * μέσα στη συναλλαγή πάνω στα φρέσκα έγγραφα.
 */
export function decideDepreciation(
  intent: DepreciationIntent,
  fiscalYear: number,
  { asset, current }: DepreciationDecisionInput
): DepreciationDecision {
  const booked = current?.annualDepreciation ?? 0;
  if (intent === 'reverse' && booked !== 0 && laterYearPosted(asset, fiscalYear)) {
    return { kind: 'refused', reason: 'LATER_YEAR_POSTED' };
  }
  const { row, target: scheduled } = depreciationTargetFor(asset, fiscalYear);
  const target = intent === 'reverse' ? 0 : scheduled;
  const delta = roundToTwo(target - booked);
  if (delta === 0) return { kind: 'unchanged' };

  return {
    kind: 'post',
    record: depreciationRecordBodyOf(asset, row, target),
    journal: depreciationJournalLineFor(asset, fiscalYear, delta),
    assetProjection: assetProjectionAt(asset, withYear(bookedYearsOf(asset), fiscalYear, target > 0)),
  };
}

/** Το καταχωρημένο ποσό μιας εγγραφής (ή 0) — για προεπισκόπηση και σύνολα. */
export function bookedAmountOf(record: DepreciationRecord | null): number {
  return record?.annualDepreciation ?? 0;
}
