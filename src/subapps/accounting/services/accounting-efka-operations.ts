/**
 * @fileoverview Accounting EFKA Operations — Standalone EFKA summary calculators
 * @description Extracted from AccountingService via Dependency Injection pattern.
 *   Handles per-entity EFKA summary calculations (ΟΕ partners, ΕΠΕ managers, ΑΕ board).
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-28
 * @see ADR-ACC-000 Founding Decision
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { IAccountingRepository } from '../types/interfaces';
import type {
  EFKAAnnualSummary,
  EFKAPayment,
  PartnershipEFKASummary,
  PartnerEFKASummary,
  EPEEFKASummary,
  ManagerEFKASummary,
  AEEFKASummary,
  EmployeeBoardMemberEFKA,
} from '../types/efka';
import { calculateMonthlyBreakdown } from './config/efka-config';
import { roundToTwo } from '../utils/math';
import { sumPaidEfka } from './tax/entity-tax-profile';

// ============================================================================
// ΕΤΗΣΙΑ ΣΥΝΟΨΗ ΕΝΟΣ ΑΣΦΑΛΙΣΜΕΝΟΥ (SSoT)
// ============================================================================

/** Οι κωδικοί κατηγορίας εισφορών που επέλεξε ο ασφαλισμένος (ελλείποντες ⇒ 1η κατηγορία). */
export interface EfkaCodeSelection {
  readonly selectedMainPensionCode?: string | null;
  readonly selectedSupplementaryCode?: string | null;
  readonly selectedLumpSumCode?: string | null;
}

/**
 * Ετήσια σύνοψη ΕΦΚΑ ενός ασφαλισμένου (ατομική, εταίρος ΟΕ, διαχειριστής ΕΠΕ, μέλος ΔΣ ΑΕ). Ήταν τέσσερα
 * αντίγραφα (εδώ ×3 + `accounting-service`) — jscpd, 2026-10-14.
 */
export function buildEfkaAnnualSummary(
  year: number,
  payments: EFKAPayment[],
  codes: EfkaCodeSelection | null | undefined
): EFKAAnnualSummary {
  const monthlyBreakdown = calculateMonthlyBreakdown(
    year,
    codes?.selectedMainPensionCode || 'main_1',
    codes?.selectedSupplementaryCode || 'supplementary_1',
    codes?.selectedLumpSumCode || 'lump_sum_1'
  );
  const totalPaid = sumPaidEfka(payments);
  const totalDue = monthlyBreakdown.reduce((sum, m) => sum + m.totalMonthly, 0);
  return {
    year,
    monthlyBreakdown,
    payments,
    totalPaid,
    totalDue,
    balanceDue: roundToTwo(totalDue - totalPaid),
    taxDeductibleAmount: totalPaid,
    paidMonths: payments.filter((pay) => pay.status === 'paid').length,
    overdueMonths: payments.filter((pay) => pay.status === 'overdue' || pay.status === 'keao').length,
  };
}

// ============================================================================
// ΟΕ — PARTNERSHIP EFKA SUMMARY
// ============================================================================

/**
 * Σύνοψη ΕΦΚΑ ΟΕ (per-partner)
 *
 * @param repository - Accounting repository (DI)
 * @param year       - Fiscal year
 */
export async function calculatePartnershipEfkaSummary(
  repository: IAccountingRepository,
  year: number
): Promise<PartnershipEFKASummary> {
  const partners = await repository.getPartners();
  const partnerSummaries: PartnerEFKASummary[] = [];
  let totalAllPartnersPaid = 0;
  let totalAllPartnersDue = 0;

  for (const p of partners) {
    const summary = buildEfkaAnnualSummary(year, await repository.getPartnerEFKAPayments(p.partnerId, year), p.efkaConfig);

    partnerSummaries.push({
      partnerId: p.partnerId,
      partnerName: p.fullName,
      summary,
    });

    totalAllPartnersPaid += summary.totalPaid;
    totalAllPartnersDue += summary.totalDue;
  }

  return {
    year,
    partnerSummaries,
    totalAllPartnersPaid,
    totalAllPartnersDue,
  };
}

// ============================================================================
// ΕΠΕ — MANAGERS EFKA SUMMARY
// ============================================================================

/**
 * Σύνοψη ΕΦΚΑ ΕΠΕ (μόνο διαχειριστές)
 *
 * @param repository - Accounting repository (DI)
 * @param year       - Fiscal year
 */
export async function calculateEPEEfkaSummary(
  repository: IAccountingRepository,
  year: number
): Promise<EPEEFKASummary> {
  const members = await repository.getMembers();
  const managers = members.filter((m) => m.isManager && m.isActive);
  const managerSummaries: ManagerEFKASummary[] = [];
  let totalAllManagersPaid = 0;
  let totalAllManagersDue = 0;

  for (const mgr of managers) {
    const summary = buildEfkaAnnualSummary(year, await repository.getMemberEFKAPayments(mgr.memberId, year), mgr.efkaConfig);

    managerSummaries.push({
      memberId: mgr.memberId,
      memberName: mgr.fullName,
      summary,
    });

    totalAllManagersPaid += summary.totalPaid;
    totalAllManagersDue += summary.totalDue;
  }

  return {
    year,
    managerSummaries,
    totalAllManagersPaid,
    totalAllManagersDue,
  };
}

// ============================================================================
// ΑΕ — BOARD OF DIRECTORS EFKA SUMMARY (DUAL MODE)
// ============================================================================

/**
 * Σύνοψη ΕΦΚΑ ΑΕ — Dual mode (employee + self-employed)
 *
 * @param repository - Accounting repository (DI)
 * @param year       - Fiscal year
 * @see ADR-ACC-017 Board of Directors & EFKA
 */
export async function calculateAEEfkaSummary(
  repository: IAccountingRepository,
  year: number
): Promise<AEEFKASummary> {
  const shareholders = await repository.getShareholders();

  const boardWithComp = shareholders.filter(
    (s) =>
      s.isBoardMember &&
      s.monthlyCompensation !== null &&
      s.monthlyCompensation > 0 &&
      s.isActive
  );

  const employeeBoardMembers: EmployeeBoardMemberEFKA[] = [];
  const selfEmployedBoardMembers: ManagerEFKASummary[] = [];
  let totalEmployeeEFKA = 0;
  let totalSelfEmployedEFKA = 0;

  for (const bm of boardWithComp) {
    if (bm.efkaMode === 'employee') {
      // Employee mode: 33,60% (12,47% employee + 21,13% employer)
      const compensation = bm.monthlyCompensation ?? 0;
      const employeeContribution = roundToTwo(compensation * 0.1247 * 12);
      const employerContribution = roundToTwo(compensation * 0.2113 * 12);
      const totalAnnual = roundToTwo(employeeContribution + employerContribution);

      employeeBoardMembers.push({
        shareholderId: bm.shareholderId,
        shareholderName: bm.fullName,
        monthlyCompensation: compensation,
        employeeContribution,
        employerContribution,
        totalAnnual,
      });

      totalEmployeeEFKA += employerContribution; // Employer cost
    } else if (bm.efkaMode === 'self_employed') {
      const summary = buildEfkaAnnualSummary(year, await repository.getShareholderEFKAPayments(bm.shareholderId, year), bm.efkaConfig);

      selfEmployedBoardMembers.push({
        memberId: bm.shareholderId,
        memberName: bm.fullName,
        summary,
      });

      totalSelfEmployedEFKA += summary.totalPaid;
    }
  }

  return {
    year,
    employeeBoardMembers,
    selfEmployedBoardMembers,
    totalEmployeeEFKA,
    totalSelfEmployedEFKA,
    totalAllEFKA: roundToTwo(totalEmployeeEFKA + totalSelfEmployedEFKA),
  };
}
