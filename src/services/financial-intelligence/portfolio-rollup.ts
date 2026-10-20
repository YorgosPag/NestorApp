/**
 * Portfolio rollup — pure arithmetic from unit documents to project and portfolio
 * summaries. No Firestore here: `portfolio-aggregator.ts` reads, this module computes,
 * so every number on the dashboard is testable without a database.
 *
 * @module services/financial-intelligence/portfolio-rollup
 * @enterprise SPEC-242C — Portfolio Dashboard
 */

import { getString, getNumber, getObject } from '@/lib/firestore/field-extractors';
import type { PortfolioSummary, ProjectFinancialSummary } from '@/types/interest-calculator';
import { assessHealth, percentOf } from './portfolio-health';

type FirestoreRecord = Record<string, unknown>;

/** Statuses that count a unit as sold for portfolio purposes. */
const SOLD_STATUSES: ReadonlySet<string> = new Set(['sold', 'reserved', 'contracted']);

/** What one unit contributes to its project. Missing metrics are `null`, never `0`. */
export interface UnitFinancials {
  salePrice: number;
  isSold: boolean;
  collected: number;
  costOfMoney: number | null;
  collectionDays: number | null;
  npv: number;
  timeCost: number;
}

/** A project summary plus the unrounded figures the portfolio totals are built from. */
export interface ProjectRollup {
  summary: ProjectFinancialSummary;
  value: number;
  collected: number;
  costOfMoney: number | null;
  collectionDays: number | null;
  npv: number;
  timeCost: number;
}

// =============================================================================
// NUMERIC HELPERS
// =============================================================================

/** Mean of the samples, or `null` when there are none — never a fabricated `0`. */
function meanOrNull(samples: readonly number[]): number | null {
  return samples.length > 0 ? samples.reduce((sum, value) => sum + value, 0) / samples.length : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function roundOrNull(value: number | null, decimals: number): number | null {
  return value === null ? null : round(value, decimals);
}

/** A metric sample only counts when it is a positive number. */
function positiveOrNull(value: number | undefined): number | null {
  return value !== undefined && value > 0 ? value : null;
}

function sumOf<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((sum, item) => sum + pick(item), 0);
}

/** Value-weighted mean over the projects that report the metric; `null` if none does. */
function weightedMeanOrNull(pairs: ReadonlyArray<{ value: number | null; weight: number }>): number | null {
  let sum = 0;
  let weight = 0;
  for (const pair of pairs) {
    if (pair.value === null || pair.weight <= 0) continue;
    sum += pair.value * pair.weight;
    weight += pair.weight;
  }
  return weight > 0 ? sum / weight : null;
}

// =============================================================================
// UNIT → PROJECT → PORTFOLIO
// =============================================================================

/** Reads one unit document. Sale price: direct fields first, then `commercial`. */
export function readUnitFinancials(propertyData: FirestoreRecord): UnitFinancials {
  const commercial = getObject<FirestoreRecord>(propertyData, 'commercial');
  const salePrice = getNumber(propertyData, 'salePrice', 0)
    || getNumber(propertyData, 'price', 0)
    || (commercial ? getNumber(commercial, 'salePrice', 0) : 0);
  const isSold = SOLD_STATUSES.has(getString(propertyData, 'status', ''));

  // Denormalized payment summary — on `commercial` first, then on the unit itself.
  const payment = (commercial ? getObject<FirestoreRecord>(commercial, 'paymentSummary') : undefined)
    ?? getObject<FirestoreRecord>(propertyData, 'paymentSummary');
  if (!payment) {
    return { salePrice, isSold, collected: 0, costOfMoney: null, collectionDays: null, npv: 0, timeCost: 0 };
  }

  return {
    salePrice,
    isSold,
    collected: getNumber(payment, 'totalPaid', 0) || getNumber(payment, 'collected', 0),
    costOfMoney: positiveOrNull(getNumber(payment, 'costOfMoney')),
    collectionDays: positiveOrNull(getNumber(payment, 'avgCollectionDays') || getNumber(payment, 'wacp')),
    npv: getNumber(payment, 'npv', 0),
    timeCost: getNumber(payment, 'timeCost', 0),
  };
}

/** Rolls a project's live units up into its summary and health. */
export function rollUpProject(
  projectId: string,
  projectName: string,
  units: readonly UnitFinancials[],
): ProjectRollup {
  const value = sumOf(units, (unit) => unit.salePrice);
  const collected = sumOf(units, (unit) => unit.collected);
  const soldProperties = units.filter((unit) => unit.isSold).length;
  const costOfMoney = meanOrNull(units.flatMap((unit) => (unit.costOfMoney === null ? [] : [unit.costOfMoney])));
  const collectionDays = meanOrNull(units.flatMap((unit) => (unit.collectionDays === null ? [] : [unit.collectionDays])));
  const health = assessHealth({
    costOfMoney,
    collectionDays,
    soldPercent: percentOf(soldProperties, units.length),
  });

  return {
    summary: {
      projectId,
      projectName,
      totalProperties: units.length,
      soldProperties,
      totalValue: round(value, 2),
      collected: round(collected, 2),
      costOfMoney: roundOrNull(costOfMoney, 2),
      avgCollectionDays: roundOrNull(collectionDays, 0),
      healthStatus: health.status,
      healthDrivers: health.drivers,
    },
    value,
    collected,
    costOfMoney,
    collectionDays,
    npv: sumOf(units, (unit) => unit.npv),
    timeCost: sumOf(units, (unit) => unit.timeCost),
  };
}

/**
 * Rolls projects up into the portfolio. Averages are weighted by project value and
 * count only projects that report the metric — a silent project carries no weight
 * instead of dragging the average towards zero.
 */
export function rollUpPortfolio(
  rollups: readonly ProjectRollup[],
  activeProjects: number,
  calculatedAt: string,
): PortfolioSummary {
  const value = sumOf(rollups, (rollup) => rollup.value);
  const collected = sumOf(rollups, (rollup) => rollup.collected);

  return {
    activeProjects,
    totalProperties: sumOf(rollups, (rollup) => rollup.summary.totalProperties),
    soldProperties: sumOf(rollups, (rollup) => rollup.summary.soldProperties),
    totalPortfolioValue: round(value, 2),
    totalCollected: round(collected, 2),
    totalOutstanding: round(value - collected, 2),
    weightedAvgCostOfMoney: roundOrNull(
      weightedMeanOrNull(rollups.map((rollup) => ({ value: rollup.costOfMoney, weight: rollup.value }))),
      2,
    ),
    weightedAvgCollectionDays: roundOrNull(
      weightedMeanOrNull(rollups.map((rollup) => ({ value: rollup.collectionDays, weight: rollup.value }))),
      0,
    ),
    totalNPV: round(sumOf(rollups, (rollup) => rollup.npv), 2),
    totalTimeCost: round(sumOf(rollups, (rollup) => rollup.timeCost), 2),
    calculatedAt,
  };
}
