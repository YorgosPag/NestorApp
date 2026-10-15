/**
 * @fileoverview Λογιστικές περίοδοι — το ΚΛΕΙΔΙ περιόδου (SSoT, καθαρό)
 * @description Το επιχειρηματικό κλειδί `YYYY-MM` (01–12 μήνες, 13 = περίοδος κλεισίματος) — ΣΧΕΤΙΚΟ με τον μισθωτή,
 *   όπως ο αριθμός περιόδου του SAP ζει μέσα σε ένα company code. Η ΔΙΕΥΘΥΝΣΗ του εγγράφου είναι άλλο πράγμα:
 *   `generateDeterministicFiscalPeriodId(companyId, κλειδί)` (`repository/accounting-repo-fiscal-periods.ts`).
 *
 *   🔴 Ως τις 2026-10-15 το κλειδί γραφόταν σε τρία σημεία (`createFiscalYear`, `getPeriodForDate`,
 *   `depreciationPeriodIdFor`) ΚΑΙ ήταν ταυτόχρονα το id του εγγράφου ⇒ μία «2026-12» για όλους τους μισθωτές.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 6)
 */

import { accountingDayOf } from '../utils/accounting-day';

/** 12 μηνιαίες + 1 περίοδος κλεισίματος (DECISIONS-PHASE-1b Q6). */
export const FISCAL_PERIODS_PER_YEAR = 13;

/** Η περίοδος κλεισίματος — μοιράζεται τις ημερομηνίες του Δεκεμβρίου, ποτέ δεν προκύπτει από ημερομηνία. */
export const ADJUSTMENT_PERIOD_NUMBER = 13;

/** Το κλειδί της περιόδου `periodNumber` (1–13) της χρήσης. */
export function fiscalPeriodKey(fiscalYear: number, periodNumber: number): string {
  return `${fiscalYear}-${String(periodNumber).padStart(2, '0')}`;
}

/** Τα 13 κλειδιά μιας χρήσης, με τη σειρά. */
export function fiscalPeriodKeysOf(fiscalYear: number): string[] {
  return Array.from({ length: FISCAL_PERIODS_PER_YEAR }, (_, i) => fiscalPeriodKey(fiscalYear, i + 1));
}

/** Η μηνιαία περίοδος (1–12) μιας ημερομηνίας εγγραφής — `null` για άκυρη ημερομηνία. */
export function fiscalPeriodKeyForDate(dateStr: string): string | null {
  const day = accountingDayOf(dateStr);
  return day === null ? null : day.slice(0, 7);
}
