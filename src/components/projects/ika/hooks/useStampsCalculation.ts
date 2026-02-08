'use client';

/**
 * =============================================================================
 * useStampsCalculation — Pure computation hook for stamps & contributions
 * =============================================================================
 *
 * Derives monthly stamps summaries from attendance data, worker info, and
 * insurance configuration. This is a PURE COMPUTATION hook — NO Firestore calls.
 *
 * Formula: contribution = stamps × imputedDailyWage × (rates / 100)
 * Where: 1 stamp = 1 day worked
 *
 * @module components/projects/ika/hooks/useStampsCalculation
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import { useMemo } from 'react';
import type {
  ProjectWorker,
  LaborComplianceConfig,
  InsuranceClass,
  ContributionRates,
  StampsMonthSummary,
  WorkerStampsSummary,
} from '../contracts';

interface UseStampsCalculationReturn {
  /** Monthly project summary with per-worker details */
  summary: StampsMonthSummary;
}

/**
 * Calculates the total employer contribution rate from ContributionRates.
 */
function calculateEmployerRate(rates: ContributionRates): number {
  return (
    rates.mainPension.employer +
    rates.health.employer +
    rates.supplementary.employer +
    rates.unemployment.employer +
    rates.iek.employer
  );
}

/**
 * Calculates the total employee contribution rate from ContributionRates.
 */
function calculateEmployeeRate(rates: ContributionRates): number {
  return (
    rates.mainPension.employee +
    rates.health.employee +
    rates.supplementary.employee +
    rates.unemployment.employee +
    rates.iek.employee +
    rates.oncePayment.employee
  );
}

/**
 * Finds the insurance class for a given class number.
 */
function findInsuranceClass(
  classNumber: number | null,
  classes: InsuranceClass[]
): InsuranceClass | null {
  if (classNumber === null) return null;
  return classes.find((c) => c.classNumber === classNumber) ?? null;
}

/**
 * Rounds a number to 2 decimal places (currency precision).
 */
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Hook for computing stamps and contribution summaries.
 *
 * This is a pure computation hook — it uses only useMemo, no Firestore.
 * Input: workers, attendance days map, and insurance configuration.
 * Output: StampsMonthSummary with per-worker breakdowns.
 */
export function useStampsCalculation(
  projectId: string | undefined,
  month: number,
  year: number,
  workers: ProjectWorker[],
  attendanceDaysMap: Map<string, number>,
  config: LaborComplianceConfig
): UseStampsCalculationReturn {
  const summary = useMemo<StampsMonthSummary>(() => {
    if (!projectId) {
      return {
        projectId: '',
        month,
        year,
        totalWorkers: 0,
        totalStamps: 0,
        totalEmployerContribution: 0,
        totalEmployeeContribution: 0,
        totalContribution: 0,
        workerSummaries: [],
        recordsWithIssues: 0,
      };
    }

    const employerRate = calculateEmployerRate(config.contributionRates);
    const employeeRate = calculateEmployeeRate(config.contributionRates);

    let totalStamps = 0;
    let totalEmployerContrib = 0;
    let totalEmployeeContrib = 0;
    let totalContrib = 0;
    let issueCount = 0;

    const workerSummaries: WorkerStampsSummary[] = workers.map((worker) => {
      const daysWorked = attendanceDaysMap.get(worker.contactId) ?? 0;
      const insuranceClass = findInsuranceClass(
        worker.insuranceClassId ? parseInt(worker.insuranceClassId, 10) : null,
        config.insuranceClasses
      );

      const stampsCount = daysWorked;
      const imputedWage = insuranceClass?.imputedDailyWage ?? null;

      let employerContribution = 0;
      let employeeContribution = 0;
      let totalContribution = 0;
      let hasIssues = false;
      let issueDescription: string | null = null;

      if (!insuranceClass) {
        hasIssues = true;
        issueDescription = 'missing_class';
        issueCount++;
      } else if (daysWorked === 0) {
        hasIssues = true;
        issueDescription = 'no_days';
        issueCount++;
      } else if (imputedWage !== null) {
        employerContribution = roundCurrency(stampsCount * imputedWage * (employerRate / 100));
        employeeContribution = roundCurrency(stampsCount * imputedWage * (employeeRate / 100));
        totalContribution = roundCurrency(employerContribution + employeeContribution);
      }

      totalStamps += stampsCount;
      totalEmployerContrib += employerContribution;
      totalEmployeeContrib += employeeContribution;
      totalContrib += totalContribution;

      return {
        contactId: worker.contactId,
        workerName: worker.name,
        companyName: worker.company,
        insuranceClassNumber: insuranceClass?.classNumber ?? null,
        imputedDailyWage: imputedWage,
        daysWorked,
        stampsCount,
        employerContribution,
        employeeContribution,
        totalContribution,
        hasIssues,
        issueDescription,
      };
    });

    return {
      projectId,
      month,
      year,
      totalWorkers: workers.length,
      totalStamps,
      totalEmployerContribution: roundCurrency(totalEmployerContrib),
      totalEmployeeContribution: roundCurrency(totalEmployeeContrib),
      totalContribution: roundCurrency(totalContrib),
      workerSummaries,
      recordsWithIssues: issueCount,
    };
  }, [projectId, month, year, workers, attendanceDaysMap, config]);

  return { summary };
}
