/**
 * =============================================================================
 * Financial Query Handler — SPEC-242E D3 NL Financial Query
 * =============================================================================
 *
 * Strategy Pattern handler implementing 6 financial intelligence tools
 * for the ADR-171 Telegram agentic loop. Admin-only.
 *
 * @module services/ai-pipeline/tools/handlers/financial-query-handler
 * @see ADR-242 SPEC-242E, ADR-171
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { ToolHandler, ToolResult, AgenticContext } from '../executor-shared';
import {
  getPortfolioSummaryForQuery,
  getProjectFinancialDetails,
  getDebtMaturitySchedule,
  getBudgetVarianceForQuery,
  calculateScenarioNPVForQuery,
  compareHedgingStrategiesForQuery,
} from '../financial-query-tools';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('FinancialQueryHandler');

// =============================================================================
// HANDLER
// =============================================================================

export class FinancialQueryHandler implements ToolHandler {
  readonly toolNames = [
    'get_portfolio_summary',
    'get_project_financial_details',
    'get_debt_maturity_schedule',
    'get_budget_variance',
    'calculate_scenario_npv',
    'compare_hedging_strategies',
  ] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Financial tools are admin-only.' };
    }

    logger.info('Financial tool called', { tool: toolName, requestId: ctx.requestId });

    try {
      switch (toolName) {
        case 'get_portfolio_summary':
          return await this.getPortfolioSummary(ctx);

        case 'get_project_financial_details':
          return await this.getProjectFinancialDetails(args, ctx);

        case 'get_debt_maturity_schedule':
          return await this.getDebtMaturitySchedule(ctx);

        case 'get_budget_variance':
          return await this.getBudgetVariance(args);

        case 'calculate_scenario_npv':
          return this.calculateScenarioNPV(args);

        case 'compare_hedging_strategies':
          return this.compareHedgingStrategies(args);

        default:
          return { success: false, error: `Unknown financial tool: ${toolName}` };
      }
    } catch (err) {
      logger.error('Financial tool error', { tool: toolName, error: getErrorMessage(err) });
      return { success: false, error: `Tool error: ${getErrorMessage(err)}` };
    }
  }

  // ---------------------------------------------------------------------------

  private async getPortfolioSummary(ctx: AgenticContext): Promise<ToolResult> {
    const data = await getPortfolioSummaryForQuery(ctx.companyId);
    return { success: true, data, count: data.projects.length };
  }

  private async getProjectFinancialDetails(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const projectId = String(args.projectId ?? '');
    if (!projectId) return { success: false, error: 'projectId is required' };

    const data = await getProjectFinancialDetails(ctx.companyId, projectId);
    if (!data) return { success: false, error: `Project not found: ${projectId}` };
    return { success: true, data, count: 1 };
  }

  private async getDebtMaturitySchedule(ctx: AgenticContext): Promise<ToolResult> {
    const entries = await getDebtMaturitySchedule(ctx.companyId);
    return { success: true, data: entries, count: entries.length };
  }

  private async getBudgetVariance(args: Record<string, unknown>): Promise<ToolResult> {
    const projectId = String(args.projectId ?? '');
    if (!projectId) return { success: false, error: 'projectId is required' };

    const analysis = await getBudgetVarianceForQuery(projectId);
    if (!analysis) return { success: true, data: null, count: 0, warning: 'No budget variance data for this project.' };
    return { success: true, data: analysis, count: 1 };
  }

  private calculateScenarioNPV(args: Record<string, unknown>): ToolResult {
    const salePrice = Number(args.salePrice ?? 0);
    const discountRate = Number(args.discountRate ?? 0);
    const rawFlows = args.cashFlows;

    if (!Array.isArray(rawFlows) || rawFlows.length === 0) {
      return { success: false, error: 'cashFlows array is required' };
    }

    const cashFlows = rawFlows.map((cf: Record<string, unknown>) => ({
      amount: Number(cf.amount ?? 0),
      date: String(cf.date ?? nowISO()),
    }));

    const npv = calculateScenarioNPVForQuery({ salePrice, cashFlows, discountRate });
    return { success: true, data: { npv, salePrice, discountRate }, count: 1 };
  }

  private compareHedgingStrategies(args: Record<string, unknown>): ToolResult {
    const notional = Number(args.notional ?? 0);
    const currentRate = Number(args.currentRate ?? 0);
    const termYears = Number(args.termYears ?? 1);

    if (notional <= 0) return { success: false, error: 'notional must be positive' };
    if (currentRate <= 0) return { success: false, error: 'currentRate must be positive' };
    if (termYears <= 0) return { success: false, error: 'termYears must be positive' };

    const result = compareHedgingStrategiesForQuery({ notional, currentRate, termYears });
    return { success: true, data: result, count: result.strategies.length };
  }
}
