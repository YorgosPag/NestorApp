/**
 * @fileoverview Tax Installments — Due Dates & Status Helpers
 * @description Pure helpers για υπολογισμό δόσεων φόρου (3 δόσεις Ιουλ/Σεπ/Νοε).
 *   Extracted from tax-engine.ts (SRP split, ADR-314 Phase C.5).
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-04-18
 * @see ADR-ACC-009 Tax Engine
 */

import type { TaxInstallment, TaxInstallmentStatus } from '../../../types/tax';
import { nowISO } from '@/lib/date-local';
import { roundToTwo } from '../../../utils/math';

/**
 * Ημερομηνίες λήξης δόσεων φόρου εισοδήματος.
 *
 * Ο φόρος χρήσης X πληρώνεται στο επόμενο έτος (X+1) σε τρεις δόσεις:
 * - 1η: 31/07 (Ιούλιος)
 * - 2η: 30/09 (Σεπτέμβριος)
 * - 3η: 30/11 (Νοέμβριος)
 *
 * @param fiscalYear - Φορολογικό έτος (X)
 * @returns ISO date strings για τις 3 δόσεις (έτος X+1)
 */
export function getInstallmentDueDates(fiscalYear: number): string[] {
  const paymentYear = fiscalYear + 1;
  return [
    `${paymentYear}-07-31`,
    `${paymentYear}-09-30`,
    `${paymentYear}-11-30`,
  ];
}

/**
 * Κατάσταση δόσης βάσει σημερινής ημερομηνίας (UTC).
 *
 * - `overdue`  → σήμερα > dueDate
 * - `due`      → τρέχων μήνας == dueDate μήνας
 * - `upcoming` → σήμερα < dueDate (άλλος μήνας)
 */
export function getInstallmentStatus(dueDate: string): TaxInstallmentStatus {
  const today = nowISO().split('T')[0];
  if (today > dueDate) return 'overdue';
  const dueMonth = dueDate.substring(0, 7);
  const todayMonth = today.substring(0, 7);
  if (dueMonth === todayMonth) return 'due';
  return 'upcoming';
}

/**
 * Υπολογισμός δόσεων φόρου βάσει συνολικού ποσού.
 *
 * Κανόνες:
 * - `totalAmount <= 0` → κενό array
 * - `totalAmount <= 30` → 1 δόση (31/07)
 * - Αλλιώς → 3 ίσες δόσεις + υπόλοιπο στην 1η (rounding safety)
 *
 * @param totalAmount - Συνολικός φόρος προς εξόφληση
 * @param fiscalYear  - Φορολογικό έτος
 */
export function calculateInstallments(
  totalAmount: number,
  fiscalYear: number
): TaxInstallment[] {
  if (totalAmount <= 0) return [];

  const installmentCount = totalAmount <= 30 ? 1 : 3;
  const baseAmount = roundToTwo(totalAmount / installmentCount);
  const remainder = roundToTwo(totalAmount - baseAmount * installmentCount);

  const dueDates = getInstallmentDueDates(fiscalYear);
  const installments: TaxInstallment[] = [];

  for (let i = 0; i < installmentCount; i++) {
    const amount = i === 0 ? roundToTwo(baseAmount + remainder) : baseAmount;
    const dueDate = dueDates[i];
    if (!dueDate) continue;

    installments.push({
      installmentNumber: i + 1,
      amount,
      dueDate,
      status: getInstallmentStatus(dueDate),
      paidDate: null,
      notes: null,
    });
  }

  return installments;
}
