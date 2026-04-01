/**
 * =============================================================================
 * Portfolio Aggregation Service — SPEC-242C
 * =============================================================================
 *
 * Server-only service that aggregates financial data across all projects.
 * Uses Admin SDK for Firestore access. Designed for API route consumption.
 *
 * @module services/financial-intelligence/portfolio-aggregator
 * @enterprise SPEC-242C — Portfolio Dashboard & Debt Maturity Wall
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { getString, getNumber, getObject } from '@/lib/firestore/field-extractors';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  HealthStatus,
  PortfolioSummary,
  ProjectFinancialSummary,
} from '@/types/interest-calculator';

const logger = createModuleLogger('PortfolioAggregator');

// =============================================================================
// HEALTH STATUS THRESHOLDS
// =============================================================================

interface HealthThresholds {
  excellent: number;
  good: number;
  warning: number;
}

const COST_OF_MONEY_THRESHOLDS: HealthThresholds = {
  excellent: 3,
  good: 5,
  warning: 8,
};

const COLLECTION_DAYS_THRESHOLDS: HealthThresholds = {
  excellent: 180,
  good: 365,
  warning: 540,
};

const SOLD_PERCENT_THRESHOLDS: HealthThresholds = {
  excellent: 80,
  good: 60,
  warning: 40,
};

// =============================================================================
// HEALTH STATUS CALCULATOR
// =============================================================================

function getMetricHealth(value: number, thresholds: HealthThresholds, lowerIsBetter: boolean): HealthStatus {
  if (lowerIsBetter) {
    if (value < thresholds.excellent) return 'excellent';
    if (value < thresholds.good) return 'good';
    if (value < thresholds.warning) return 'warning';
    return 'critical';
  }
  // Higher is better (e.g. sold %)
  if (value > thresholds.excellent) return 'excellent';
  if (value > thresholds.good) return 'good';
  if (value > thresholds.warning) return 'warning';
  return 'critical';
}

const HEALTH_PRIORITY: Record<HealthStatus, number> = {
  critical: 0,
  warning: 1,
  good: 2,
  excellent: 3,
};

function worstHealth(...statuses: HealthStatus[]): HealthStatus {
  let worst: HealthStatus = 'excellent';
  for (const s of statuses) {
    if (HEALTH_PRIORITY[s] < HEALTH_PRIORITY[worst]) {
      worst = s;
    }
  }
  return worst;
}

// =============================================================================
// MAIN AGGREGATION
// =============================================================================

interface PortfolioAggregationResult {
  portfolio: PortfolioSummary;
  projects: ProjectFinancialSummary[];
}

/**
 * Aggregate financial data across all projects for a company.
 * Uses denormalized paymentSummary on unit docs when available.
 */
export async function aggregatePortfolio(companyId: string): Promise<PortfolioAggregationResult> {
  const db = getAdminFirestore();
  const startTime = Date.now();

  // 1. Get all active projects for this company
  const projectsSnap = await db
    .collection(COLLECTIONS.PROJECTS)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .get();

  logger.info(`[Portfolio] Found ${projectsSnap.size} projects for company ${companyId}`);

  const projectSummaries: ProjectFinancialSummary[] = [];

  let totalPortfolioValue = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  let totalNPV = 0;
  let totalTimeCost = 0;
  let totalPropertiesAll = 0;
  let soldPropertiesAll = 0;

  // Weighted average accumulators
  let weightedCostSum = 0;
  let weightedDaysSum = 0;
  let weightTotal = 0;

  // 2. Per project — get units and aggregate
  for (const projectDoc of projectsSnap.docs) {
    try {
      const projectData = projectDoc.data();
      const projectId = projectDoc.id;
      const projectName = getString(projectData, 'name', '') || getString(projectData, 'title', 'Unknown');

      // Query units for this project — S-1 fix: add companyId tenant isolation
      const propertiesSnap = await db
        .collection(COLLECTIONS.PROPERTIES)
        .where('project', '==', projectId)
        .where(FIELDS.COMPANY_ID, '==', companyId)
        .get();

      let projectTotalValue = 0;
      let projectCollected = 0;
      const projectTotalProperties = propertiesSnap.size;
      let projectSoldProperties = 0;
      let projectCostOfMoneySum = 0;
      let projectCostOfMoneyCount = 0;
      let projectCollectionDaysSum = 0;
      let projectCollectionDaysCount = 0;

      for (const propertyDoc of propertiesSnap.docs) {
        const propertyData = propertyDoc.data();

        // Extract sale price — try direct fields first, then nested commercial object
        const commercial = getObject<Record<string, unknown>>(propertyData, 'commercial');
        const salePrice = getNumber(propertyData, 'salePrice', 0)
          || getNumber(propertyData, 'price', 0)
          || (commercial ? getNumber(commercial, 'salePrice', 0) : 0);

        projectTotalValue += salePrice;

        // Check if sold
        const status = getString(propertyData, 'status', '');
        const isSold = status === 'sold' || status === 'reserved' || status === 'contracted';
        if (isSold) projectSoldProperties++;

        // Use denormalized paymentSummary if available
        const paymentSummary = (commercial ? getObject<Record<string, unknown>>(commercial, 'paymentSummary') : undefined)
          ?? getObject<Record<string, unknown>>(propertyData, 'paymentSummary');

        if (paymentSummary) {
          const collected = getNumber(paymentSummary, 'totalPaid', 0)
            || getNumber(paymentSummary, 'collected', 0);
          projectCollected += collected;

          const costOfMoney = getNumber(paymentSummary, 'costOfMoney');
          if (costOfMoney !== undefined && costOfMoney > 0) {
            projectCostOfMoneySum += costOfMoney;
            projectCostOfMoneyCount++;
          }

          const avgCollectionDays = getNumber(paymentSummary, 'avgCollectionDays')
            || getNumber(paymentSummary, 'wacp');
          if (avgCollectionDays !== undefined && avgCollectionDays > 0) {
            projectCollectionDaysSum += avgCollectionDays;
            projectCollectionDaysCount++;
          }

          const npv = getNumber(paymentSummary, 'npv', 0);
          totalNPV += npv;

          const timeCost = getNumber(paymentSummary, 'timeCost', 0);
          totalTimeCost += timeCost;
        }
      }

      const projectOutstanding = projectTotalValue - projectCollected;
      const avgCostOfMoney = projectCostOfMoneyCount > 0
        ? projectCostOfMoneySum / projectCostOfMoneyCount
        : 0;
      const avgCollectionDays = projectCollectionDaysCount > 0
        ? projectCollectionDaysSum / projectCollectionDaysCount
        : 0;
      const soldPercent = projectTotalProperties > 0
        ? (projectSoldProperties / projectTotalProperties) * 100
        : 0;

      // Health status (worst of 3 metrics)
      const costHealth = getMetricHealth(avgCostOfMoney, COST_OF_MONEY_THRESHOLDS, true);
      const daysHealth = getMetricHealth(avgCollectionDays, COLLECTION_DAYS_THRESHOLDS, true);
      const soldHealth = getMetricHealth(soldPercent, SOLD_PERCENT_THRESHOLDS, false);
      const healthStatus = worstHealth(costHealth, daysHealth, soldHealth);

      projectSummaries.push({
        projectId,
        projectName,
        totalProperties: projectTotalProperties,
        soldProperties: projectSoldProperties,
        totalValue: Math.round(projectTotalValue * 100) / 100,
        collected: Math.round(projectCollected * 100) / 100,
        costOfMoney: Math.round(avgCostOfMoney * 100) / 100,
        avgCollectionDays: Math.round(avgCollectionDays),
        healthStatus,
      });

      // Accumulate portfolio totals
      totalPortfolioValue += projectTotalValue;
      totalCollected += projectCollected;
      totalOutstanding += projectOutstanding;
      totalPropertiesAll += projectTotalProperties;
      soldPropertiesAll += projectSoldProperties;

      // Weighted averages (by project value)
      if (projectTotalValue > 0) {
        weightedCostSum += avgCostOfMoney * projectTotalValue;
        weightedDaysSum += avgCollectionDays * projectTotalValue;
        weightTotal += projectTotalValue;
      }
    } catch (err) {
      logger.warn(`[Portfolio] Failed to aggregate project ${projectDoc.id}, skipping`, {
        error: getErrorMessage(err),
      });
      continue;
    }
  }

  const weightedAvgCostOfMoney = weightTotal > 0
    ? Math.round((weightedCostSum / weightTotal) * 100) / 100
    : 0;
  const weightedAvgCollectionDays = weightTotal > 0
    ? Math.round(weightedDaysSum / weightTotal)
    : 0;

  const portfolio: PortfolioSummary = {
    activeProjects: projectsSnap.size,
    totalProperties: totalPropertiesAll,
    soldProperties: soldPropertiesAll,
    totalPortfolioValue: Math.round(totalPortfolioValue * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    weightedAvgCostOfMoney,
    weightedAvgCollectionDays,
    totalNPV: Math.round(totalNPV * 100) / 100,
    totalTimeCost: Math.round(totalTimeCost * 100) / 100,
    calculatedAt: new Date().toISOString(),
  };

  const duration = Date.now() - startTime;
  logger.info(`[Portfolio] Aggregation complete in ${duration}ms`, {
    projects: projectsSnap.size,
    totalProperties: totalPropertiesAll,
  });

  return { portfolio, projects: projectSummaries };
}
