/**
 * SPEC-242C — portfolio health: absence of data is not a signal, and every status
 * names the metrics that decided it.
 */

import type { PortfolioSummary, ProjectFinancialSummary } from '@/types/interest-calculator';
import {
  assessHealth,
  assessPortfolioKpis,
  combineAssessments,
  percentOf,
  rateMetric,
  worstHealth,
} from '../portfolio-health';

describe('rateMetric', () => {
  it('a missing sample rates noData — never as if it were zero', () => {
    expect(rateMetric('soldPercent', null)).toBe('noData');
    expect(rateMetric('costOfMoney', null)).toBe('noData');
    expect(rateMetric('collectionDays', Number.NaN)).toBe('noData');
  });

  it('lower-is-better thresholds are strict upper bounds', () => {
    expect(rateMetric('costOfMoney', 2.99)).toBe('excellent');
    expect(rateMetric('costOfMoney', 3)).toBe('good');
    expect(rateMetric('costOfMoney', 5)).toBe('warning');
    expect(rateMetric('costOfMoney', 8)).toBe('critical');
  });

  it('higher-is-better thresholds are strict lower bounds; a measured 0% is critical', () => {
    expect(rateMetric('soldPercent', 81)).toBe('excellent');
    expect(rateMetric('soldPercent', 80)).toBe('good');
    expect(rateMetric('soldPercent', 41)).toBe('warning');
    expect(rateMetric('soldPercent', 0)).toBe('critical');
  });
});

describe('worstHealth', () => {
  it('noData never outranks a measurement, and wins only when nothing was measured', () => {
    expect(worstHealth(['noData', 'excellent'])).toBe('excellent');
    expect(worstHealth(['good', 'noData', 'critical'])).toBe('critical');
    expect(worstHealth(['noData', 'noData'])).toBe('noData');
    expect(worstHealth([])).toBe('noData');
  });
});

describe('assessHealth', () => {
  it('a project with no units and no payment data is noData, not critical', () => {
    expect(assessHealth({ costOfMoney: null, collectionDays: null, soldPercent: percentOf(0, 0) }))
      .toEqual({ status: 'noData', drivers: [] });
  });

  it('names every metric that sets the worst status', () => {
    expect(assessHealth({ costOfMoney: 9, collectionDays: 600, soldPercent: 90 }))
      .toEqual({ status: 'critical', drivers: ['costOfMoney', 'collectionDays'] });
  });

  it('judges only what was measured', () => {
    expect(assessHealth({ costOfMoney: null, collectionDays: null, soldPercent: 50 }))
      .toEqual({ status: 'warning', drivers: ['soldPercent'] });
  });
});

describe('combineAssessments', () => {
  it('takes the worst and unions the drivers of every assessment at that status', () => {
    expect(combineAssessments([
      { status: 'critical', drivers: ['soldPercent'] },
      { status: 'noData', drivers: [] },
      { status: 'critical', drivers: ['costOfMoney', 'soldPercent'] },
      { status: 'good', drivers: ['collectionDays'] },
    ])).toEqual({ status: 'critical', drivers: ['soldPercent', 'costOfMoney'] });
  });
});

describe('assessPortfolioKpis', () => {
  const emptyPortfolio: PortfolioSummary = {
    activeProjects: 2,
    totalProperties: 0,
    soldProperties: 0,
    totalPortfolioValue: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    weightedAvgCostOfMoney: null,
    weightedAvgCollectionDays: null,
    totalNPV: 0,
    totalTimeCost: 0,
    calculatedAt: '2026-10-20T00:00:00.000Z',
  };

  const emptyProject = (projectId: string): ProjectFinancialSummary => ({
    projectId,
    projectName: projectId,
    totalProperties: 0,
    soldProperties: 0,
    totalValue: 0,
    collected: 0,
    costOfMoney: null,
    avgCollectionDays: null,
    healthStatus: 'noData',
    healthDrivers: [],
  });

  it('an empty portfolio is noData on all four cards (was Critical/Warning/Excellent/Excellent)', () => {
    const health = assessPortfolioKpis(emptyPortfolio, [emptyProject('a'), emptyProject('b')]);
    expect(Object.values(health).map((entry) => entry.status))
      .toEqual(['noData', 'noData', 'noData', 'noData']);
  });
});
