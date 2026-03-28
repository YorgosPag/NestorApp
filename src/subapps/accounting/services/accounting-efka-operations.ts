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
  PartnershipEFKASummary,
  PartnerEFKASummary,
  EPEEFKASummary,
  ManagerEFKASummary,
  AEEFKASummary,
  EmployeeBoardMemberEFKA,
} from '../types/efka';
import { calculateMonthlyBreakdown } from './config/efka-config';

// ============================================================================
// HELPER
// ============================================================================

/**
 * Στρογγυλοποίηση σε 2 δεκαδικά ψηφία (banker-safe με Number.EPSILON).
 */
export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    const payments = await repository.getPartnerEFKAPayments(p.partnerId, year);
    const mainCode = p.efkaConfig.selectedMainPensionCode || 'main_1';
    const suppCode = p.efkaConfig.selectedSupplementaryCode || 'supplementary_1';
    const lumpCode = p.efkaConfig.selectedLumpSumCode || 'lump_sum_1';

    const monthlyBreakdown = calculateMonthlyBreakdown(year, mainCode, suppCode, lumpCode);

    const totalPaid = payments
      .filter((pay) => pay.status === 'paid')
      .reduce((sum, pay) => sum + pay.amount, 0);
    const totalDue = monthlyBreakdown.reduce((sum, m) => sum + m.totalMonthly, 0);
    const balanceDue = roundToTwo(totalDue - totalPaid);
    const paidMonths = payments.filter((pay) => pay.status === 'paid').length;
    const overdueMonths = payments.filter(
      (pay) => pay.status === 'overdue' || pay.status === 'keao'
    ).length;

    partnerSummaries.push({
      partnerId: p.partnerId,
      partnerName: p.fullName,
      summary: {
        year,
        monthlyBreakdown,
        payments,
        totalPaid,
        totalDue,
        balanceDue,
        taxDeductibleAmount: totalPaid,
        paidMonths,
        overdueMonths,
      },
    });

    totalAllPartnersPaid += totalPaid;
    totalAllPartnersDue += totalDue;
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
    const payments = await repository.getMemberEFKAPayments(mgr.memberId, year);
    const mainCode = mgr.efkaConfig?.selectedMainPensionCode || 'main_1';
    const suppCode = mgr.efkaConfig?.selectedSupplementaryCode || 'supplementary_1';
    const lumpCode = mgr.efkaConfig?.selectedLumpSumCode || 'lump_sum_1';

    const monthlyBreakdown = calculateMonthlyBreakdown(year, mainCode, suppCode, lumpCode);

    const totalPaid = payments
      .filter((pay) => pay.status === 'paid')
      .reduce((sum, pay) => sum + pay.amount, 0);
    const totalDue = monthlyBreakdown.reduce((sum, m) => sum + m.totalMonthly, 0);
    const balanceDue = roundToTwo(totalDue - totalPaid);
    const paidMonths = payments.filter((pay) => pay.status === 'paid').length;
    const overdueMonths = payments.filter(
      (pay) => pay.status === 'overdue' || pay.status === 'keao'
    ).length;

    managerSummaries.push({
      memberId: mgr.memberId,
      memberName: mgr.fullName,
      summary: {
        year,
        monthlyBreakdown,
        payments,
        totalPaid,
        totalDue,
        balanceDue,
        taxDeductibleAmount: totalPaid,
        paidMonths,
        overdueMonths,
      },
    });

    totalAllManagersPaid += totalPaid;
    totalAllManagersDue += totalDue;
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
      const payments = await repository.getShareholderEFKAPayments(bm.shareholderId, year);
      const mainCode = bm.efkaConfig?.selectedMainPensionCode || 'main_1';
      const suppCode = bm.efkaConfig?.selectedSupplementaryCode || 'supplementary_1';
      const lumpCode = bm.efkaConfig?.selectedLumpSumCode || 'lump_sum_1';

      const monthlyBreakdown = calculateMonthlyBreakdown(year, mainCode, suppCode, lumpCode);

      const totalPaid = payments
        .filter((pay) => pay.status === 'paid')
        .reduce((sum, pay) => sum + pay.amount, 0);
      const totalDue = monthlyBreakdown.reduce((sum, m) => sum + m.totalMonthly, 0);
      const balanceDue = roundToTwo(totalDue - totalPaid);
      const paidMonths = payments.filter((pay) => pay.status === 'paid').length;
      const overdueMonths = payments.filter(
        (pay) => pay.status === 'overdue' || pay.status === 'keao'
      ).length;

      selfEmployedBoardMembers.push({
        memberId: bm.shareholderId,
        memberName: bm.fullName,
        summary: {
          year,
          monthlyBreakdown,
          payments,
          totalPaid,
          totalDue,
          balanceDue,
          taxDeductibleAmount: totalPaid,
          paidMonths,
          overdueMonths,
        },
      });

      totalSelfEmployedEFKA += totalPaid;
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
