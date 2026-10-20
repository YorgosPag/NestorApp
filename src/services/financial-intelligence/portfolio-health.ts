/**
 * Portfolio health — the one rulebook that turns financial metrics into a traffic light.
 *
 * Three principles, each one a bug this module replaced:
 *
 * 1. **Absence of data is not a signal.** A metric with no sample is `null` and rates
 *    `noData` — never `0`. Before, a project with no units scored "0% sold" ⇒ Critical,
 *    and a portfolio with no payment data scored "0.00% cost of money" ⇒ Excellent. Both
 *    were inventions. (Same stance as monitoring tools, where "No Data" is its own state,
 *    distinct from OK and Alert.)
 * 2. **One set of written, quantified thresholds.** The server aggregator and the KPI
 *    cards used to carry two copies of the same numbers.
 * 3. **Every status is explainable.** An assessment carries the metrics that decided it,
 *    so the UI can say *why* a project is red instead of just that it is.
 *
 * Pure — safe on client and server.
 *
 * @module services/financial-intelligence/portfolio-health
 * @enterprise SPEC-242C — Portfolio Dashboard
 */

import type {
  HealthMetricKey,
  HealthStatus,
  PortfolioSummary,
  ProjectFinancialSummary,
} from '@/types/interest-calculator';

interface MetricThresholds {
  excellent: number;
  good: number;
  warning: number;
  lowerIsBetter: boolean;
}

/** Written criteria for each metric. Change a threshold here and only here. */
export const HEALTH_THRESHOLDS: Readonly<Record<HealthMetricKey, MetricThresholds>> = {
  /** Effective cost of money (%) — lower is better */
  costOfMoney: { excellent: 3, good: 5, warning: 8, lowerIsBetter: true },
  /** Average collection period (days) — lower is better */
  collectionDays: { excellent: 180, good: 365, warning: 540, lowerIsBetter: true },
  /** Share of units sold (%) — higher is better */
  soldPercent: { excellent: 80, good: 60, warning: 40, lowerIsBetter: false },
  /** Share of portfolio value already collected (%) — higher is better */
  collectedPercent: { excellent: 75, good: 50, warning: 25, lowerIsBetter: false },
};

/** Severity order; `noData` is outside it on purpose — it never outranks a measurement. */
const SEVERITY: Readonly<Record<Exclude<HealthStatus, 'noData'>, number>> = {
  critical: 0,
  warning: 1,
  good: 2,
  excellent: 3,
};

export interface HealthAssessment {
  status: HealthStatus;
  /** The metrics whose rating equals `status` — empty when `status` is `noData`. */
  drivers: HealthMetricKey[];
}

/** Rates one metric. `null` (no sample) rates `noData`. */
export function rateMetric(key: HealthMetricKey, value: number | null): HealthStatus {
  if (value === null || !Number.isFinite(value)) return 'noData';
  const { excellent, good, warning, lowerIsBetter } = HEALTH_THRESHOLDS[key];
  if (lowerIsBetter) {
    if (value < excellent) return 'excellent';
    if (value < good) return 'good';
    if (value < warning) return 'warning';
    return 'critical';
  }
  if (value > excellent) return 'excellent';
  if (value > good) return 'good';
  if (value > warning) return 'warning';
  return 'critical';
}

/** Worst measured status; `noData` only when nothing was measured. */
export function worstHealth(statuses: readonly HealthStatus[]): HealthStatus {
  let worst: HealthStatus = 'noData';
  for (const status of statuses) {
    if (status === 'noData') continue;
    if (worst === 'noData' || SEVERITY[status] < SEVERITY[worst]) worst = status;
  }
  return worst;
}

/** Rates every given metric and returns the worst, with the metrics that set it. */
export function assessHealth(
  metrics: Readonly<Partial<Record<HealthMetricKey, number | null>>>,
): HealthAssessment {
  const rated = (Object.keys(metrics) as HealthMetricKey[]).map((key) => ({
    key,
    status: rateMetric(key, metrics[key] ?? null),
  }));
  const status = worstHealth(rated.map((entry) => entry.status));
  const drivers = status === 'noData'
    ? []
    : rated.filter((entry) => entry.status === status).map((entry) => entry.key);
  return { status, drivers };
}

/**
 * Worst of several assessments (e.g. the portfolio from its projects). The drivers are
 * the union of the drivers of every assessment that shares the worst status.
 */
export function combineAssessments(assessments: readonly HealthAssessment[]): HealthAssessment {
  const status = worstHealth(assessments.map((entry) => entry.status));
  if (status === 'noData') return { status, drivers: [] };
  const drivers = new Set<HealthMetricKey>();
  for (const entry of assessments) {
    if (entry.status === status) entry.drivers.forEach((key) => drivers.add(key));
  }
  return { status, drivers: [...drivers] };
}

/** Percentage `part / whole`, or `null` when there is no whole to divide by. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

export interface PortfolioKpiHealth {
  totalValue: HealthAssessment;
  collected: HealthAssessment;
  costOfMoney: HealthAssessment;
  collectionDays: HealthAssessment;
}

/** Health of each portfolio KPI card, judged by the same rules as every project. */
export function assessPortfolioKpis(
  portfolio: PortfolioSummary,
  projects: readonly ProjectFinancialSummary[],
): PortfolioKpiHealth {
  return {
    totalValue: combineAssessments(
      projects.map((project) => ({ status: project.healthStatus, drivers: project.healthDrivers })),
    ),
    collected: assessHealth({
      collectedPercent: percentOf(portfolio.totalCollected, portfolio.totalPortfolioValue),
    }),
    costOfMoney: assessHealth({ costOfMoney: portfolio.weightedAvgCostOfMoney }),
    collectionDays: assessHealth({ collectionDays: portfolio.weightedAvgCollectionDays }),
  };
}
