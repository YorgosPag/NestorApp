/**
 * @jest-environment jsdom
 */

/**
 * ADR-917 Φ3γ — the budget card: every bar says its SOURCE (never colour alone), an allowance is drawn as an
 * estimate, land exchange is in kind outside the totals (Ζ2), and the Λ7 completeness signals are shown.
 */

import { render, screen } from '@testing-library/react';
import type { ProjectCostLedgerView } from '@/services/project-cost/cost-ledger-view';
import { isEstimateBar, ledgerCategoryText, toLedgerPoints } from '../cost-ledger-points';
import { CostLedgerSummary } from '../CostLedgerSummary';

const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key);

function viewRow(costCode: string, budgetSource: 'boq' | 'allowance' | 'soft' | null) {
  return {
    costCode, budgetSource, budget: budgetSource === null ? null : 100, budgetLinesAmount: null, estimateDelta: null,
    pending: 0, committed: 0, delivered: 0, projected: 10, variance: null, boqItemCount: 0, unpricedBoqItemCount: 0, coveredBoqItemCount: 0,
  };
}

function ledger(over: Partial<ProjectCostLedgerView> = {}): ProjectCostLedgerView {
  return {
    projectId: 'proj_1',
    isEmpty: false,
    rows: [],
    totals: { budget: 100, softBudget: 0, projected: 10, variance: -90, unbudgetedProjected: 0, committed: 10, delivered: 0 },
    completeness: {
      boqItemCount: 1, coveredBoqItemCount: 0, coveragePct: 0, codesWithoutBudget: 0, unpricedBoqItemCount: 0,
      allowanceCodes: 0, excludedSummaryCount: 0, unresolvedGroupRoleCount: 0,
    },
    landExchange: null,
    ...over,
  };
}

describe('source per bar (Φ3γ)', () => {
  it('🔴 the category text carries the source; «no source» is said, never blank', () => {
    const [allowance, none] = toLedgerPoints([viewRow('OIK-2', 'allowance'), viewRow('OIK-3', null)], t);
    expect(allowance.budgetSource).toBe('allowance');
    expect(ledgerCategoryText(allowance, t)).toContain('"source":"variance.source.kind.allowance"');
    expect(ledgerCategoryText(none, t)).toContain('"source":"variance.source.kind.none"');
  });

  it('🔴 only an allowance is drawn as an estimate', () => {
    const points = toLedgerPoints(['boq', 'allowance', 'soft'].map(source => viewRow('OIK-2', source as 'boq')), t);
    expect(points.map(isEstimateBar)).toEqual([false, true, false]);
  });
});

describe('summary completeness (Ζ2 · Λ7)', () => {
  it('🔴 land exchange is shown in kind — and it is not the total budget', () => {
    render(<CostLedgerSummary ledger={ledger({ landExchange: { bartexPercentage: 35, inKindValue: 35, basis: 'current-hard-budget' } })} format={String} t={t} />);
    expect(screen.getByText('variance.source.landExchangeLabel')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('🔴 Λ7: excluded summaries and unprovable group roles are both said', () => {
    const completeness = { ...ledger().completeness, excludedSummaryCount: 2, unresolvedGroupRoleCount: 1 };
    render(<CostLedgerSummary ledger={ledger({ completeness })} format={String} t={t} />);
    expect(screen.getByText('variance.source.excludedSummariesLabel')).toBeTruthy();
    expect(screen.getByText('variance.source.unresolvedRolesLabel')).toBeTruthy();
  });

  it('nothing to say ⇒ no Λ7 / land-exchange items', () => {
    render(<CostLedgerSummary ledger={ledger()} format={String} t={t} />);
    expect(screen.queryByText('variance.source.excludedSummariesLabel')).toBeNull();
    expect(screen.queryByText('variance.source.landExchangeLabel')).toBeNull();
  });
});
