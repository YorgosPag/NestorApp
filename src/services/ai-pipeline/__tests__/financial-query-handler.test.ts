/**
 * FINANCIAL QUERY HANDLER TESTS — SPEC-242E D3
 *
 * Tests admin guard, all 6 tool dispatches, and error handling.
 *
 * @see ADR-242 SPEC-242E
 */

import '../tools/__tests__/setup';
import { FinancialQueryHandler } from '../tools/handlers/financial-query-handler';
import type { AgenticContext } from '../tools/executor-shared';

// Mock financial-query-tools
jest.mock('../tools/financial-query-tools', () => ({
  getPortfolioSummaryForQuery: jest.fn(() => Promise.resolve({ portfolio: { activeProjects: 2 }, projects: [{ projectId: 'p1' }, { projectId: 'p2' }] })),
  getProjectFinancialDetails: jest.fn(() => Promise.resolve({ projectId: 'p1', projectName: 'Test' })),
  getDebtMaturitySchedule: jest.fn(() => Promise.resolve([{ loanId: 'loan_1' }])),
  getBudgetVarianceForQuery: jest.fn(() => Promise.resolve({ projectId: 'p1', isEmpty: false, rows: [{ costCode: 'OIK-2' }] })),
  calculateScenarioNPVForQuery: jest.fn(() => 42000),
  compareHedgingStrategiesForQuery: jest.fn(() => ({ strategies: [{ strategy: 'swap' }], cheapestIndex: 0 })),
}));

const makeCtx = (isAdmin = true): AgenticContext => ({
  companyId: 'comp_test',
  isAdmin,
  channel: 'telegram',
  channelSenderId: '123',
  requestId: 'req_test',
});

describe('FinancialQueryHandler', () => {
  let handler: FinancialQueryHandler;

  beforeEach(() => {
    handler = new FinancialQueryHandler();
    jest.clearAllMocks();
  });

  it('exposes exactly 6 tool names', () => {
    expect(handler.toolNames).toHaveLength(6);
    expect(handler.toolNames).toContain('get_portfolio_summary');
    expect(handler.toolNames).toContain('compare_hedging_strategies');
  });

  it('blocks non-admin callers', async () => {
    const result = await handler.execute('get_portfolio_summary', {}, makeCtx(false));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/admin/i);
  });

  it('get_portfolio_summary returns portfolio data', async () => {
    const result = await handler.execute('get_portfolio_summary', {}, makeCtx());
    expect(result.success).toBe(true);
    expect((result.data as { portfolio: { activeProjects: number } }).portfolio.activeProjects).toBe(2);
    expect(result.count).toBe(2);
  });

  it('get_budget_variance scopes the read to the caller company (ADR-917 Φ0)', async () => {
    const { getBudgetVarianceForQuery } = jest.requireMock('../tools/financial-query-tools') as {
      getBudgetVarianceForQuery: jest.Mock;
    };
    const result = await handler.execute('get_budget_variance', { projectId: 'p1' }, makeCtx());
    expect(result.success).toBe(true);
    expect(getBudgetVarianceForQuery).toHaveBeenCalledWith('comp_test', 'p1');
    expect(result.count).toBe(1);
  });

  it('get_budget_variance says «nothing recorded» for an empty ledger instead of reporting zeros (ADR-917 Δ2)', async () => {
    const { getBudgetVarianceForQuery } = jest.requireMock('../tools/financial-query-tools') as {
      getBudgetVarianceForQuery: jest.Mock;
    };
    getBudgetVarianceForQuery.mockResolvedValueOnce({ projectId: 'p1', isEmpty: true, rows: [] });
    const result = await handler.execute('get_budget_variance', { projectId: 'p1' }, makeCtx());
    expect(result.count).toBe(0);
    expect(result.warning).toMatch(/no BOQ or purchase orders/);
  });

  it('get_budget_variance reports a foreign/missing project as not found', async () => {
    const { getBudgetVarianceForQuery } = jest.requireMock('../tools/financial-query-tools') as {
      getBudgetVarianceForQuery: jest.Mock;
    };
    getBudgetVarianceForQuery.mockResolvedValueOnce(null);
    const result = await handler.execute('get_budget_variance', { projectId: 'p1' }, makeCtx());
    expect(result.data).toBeNull();
    expect(result.warning).toMatch(/not found/);
  });

  it('get_project_financial_details requires projectId', async () => {
    const result = await handler.execute('get_project_financial_details', {}, makeCtx());
    expect(result.success).toBe(false);
  });

  it('get_project_financial_details returns project', async () => {
    const result = await handler.execute('get_project_financial_details', { projectId: 'p1' }, makeCtx());
    expect(result.success).toBe(true);
    expect((result.data as { projectId: string }).projectId).toBe('p1');
  });

  it('get_debt_maturity_schedule returns entries', async () => {
    const result = await handler.execute('get_debt_maturity_schedule', {}, makeCtx());
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it('calculate_scenario_npv returns npv value', async () => {
    const args = { salePrice: 100000, cashFlows: [{ amount: 50000, date: '2026-06-01' }], discountRate: 0.05 };
    const result = await handler.execute('calculate_scenario_npv', args, makeCtx());
    expect(result.success).toBe(true);
    expect((result.data as { npv: number }).npv).toBe(42000);
  });

  it('compare_hedging_strategies validates notional > 0', async () => {
    const result = await handler.execute('compare_hedging_strategies', { notional: 0, currentRate: 5, termYears: 2 }, makeCtx());
    expect(result.success).toBe(false);
  });

  it('compare_hedging_strategies returns result', async () => {
    const result = await handler.execute('compare_hedging_strategies', { notional: 1000000, currentRate: 5.4, termYears: 3 }, makeCtx());
    expect(result.success).toBe(true);
    expect((result.data as { cheapestIndex: number }).cheapestIndex).toBe(0);
  });

  it('returns error for unknown tool', async () => {
    const result = await handler.execute('unknown_tool', {}, makeCtx());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown/);
  });
});
