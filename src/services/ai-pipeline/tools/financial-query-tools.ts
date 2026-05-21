/**
 * =============================================================================
 * Financial Query Tools — SPEC-242E D3 NL Financial Query
 * =============================================================================
 *
 * 6 pure data functions for the financial query agentic tools.
 * READ-ONLY. Zero side effects. Used by:
 *   - FinancialQueryHandler (Telegram agentic loop)
 *   - /api/financial-intelligence/query (web chat endpoint)
 *
 * @module services/ai-pipeline/tools/financial-query-tools
 * @see ADR-242 SPEC-242E
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { aggregatePortfolio } from '@/services/financial-intelligence/portfolio-aggregator';
import { compareHedgingStrategies } from '@/lib/hedging-engine';
import { calculateNPV } from '@/lib/npv-engine';
import { nowISO } from '@/lib/date-local';
import type {
  PortfolioSummary,
  ProjectFinancialSummary,
  DebtMaturityEntry,
  BudgetVarianceAnalysis,
  HedgingInput,
  HedgingComparisonResult,
  CashFlowEntry,
} from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

export interface PortfolioQueryResult {
  portfolio: PortfolioSummary;
  projects: ProjectFinancialSummary[];
}

export interface NPVQueryParams {
  salePrice: number;
  cashFlows: Array<{ amount: number; date: string }>;
  discountRate: number;
}

export interface HedgingQueryParams {
  notional: number;
  currentRate: number;
  termYears: number;
}

// =============================================================================
// DATA FUNCTIONS
// =============================================================================

/**
 * Returns aggregated portfolio summary + per-project details.
 * Delegates to portfolio-aggregator (aggregates Firestore projects/units).
 */
export async function getPortfolioSummaryForQuery(companyId: string): Promise<PortfolioQueryResult> {
  const result = await aggregatePortfolio(companyId);
  return { portfolio: result.portfolio, projects: result.projects };
}

/**
 * Returns financial details for a single project by ID.
 * Aggregates all projects and finds the matching one.
 */
export async function getProjectFinancialDetails(
  companyId: string,
  projectId: string
): Promise<ProjectFinancialSummary | null> {
  const result = await aggregatePortfolio(companyId);
  return result.projects.find(p => p.projectId === projectId) ?? null;
}

/**
 * Returns all debt maturity entries for the company.
 * Stored as a settings document: debt_maturity_{companyId}.
 */
export async function getDebtMaturitySchedule(companyId: string): Promise<DebtMaturityEntry[]> {
  const db = getAdminFirestore();
  const docId = `debt_maturity_${companyId}`;
  const snap = await db.collection(COLLECTIONS.SETTINGS).doc(docId).get();
  if (!snap.exists) return [];
  return (snap.data()?.entries as DebtMaturityEntry[]) ?? [];
}

/**
 * Returns budget vs actual variance analysis for a specific project.
 * Stored as a settings document: budget_variance_{projectId}.
 */
export async function getBudgetVarianceForQuery(projectId: string): Promise<BudgetVarianceAnalysis | null> {
  const db = getAdminFirestore();
  const docId = `budget_variance_${projectId}`;
  const snap = await db.collection(COLLECTIONS.SETTINGS).doc(docId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;
  return data as BudgetVarianceAnalysis;
}

/**
 * Calculate NPV for given cash flows and discount rate.
 * Pure math — no Firestore access.
 */
export function calculateScenarioNPVForQuery(params: NPVQueryParams): number {
  const flows: CashFlowEntry[] = params.cashFlows.map((cf, i) => ({
    label: `Flow ${i + 1}`,
    amount: cf.amount,
    date: cf.date,
    certainty: 'certain' as const,
  }));
  return calculateNPV(flows, nowISO(), params.discountRate);
}

/**
 * Compare all 4 hedging strategies (Floating / Swap / Cap / Collar).
 * Builds HedgingInput with sensible defaults from the 3 key params.
 * Pure math — no Firestore access.
 */
export function compareHedgingStrategiesForQuery(params: HedgingQueryParams): HedgingComparisonResult {
  const { notional, currentRate, termYears } = params;

  const input: HedgingInput = {
    notional,
    termYears,
    currentFloatingRate: currentRate,
    swapRate: Math.max(0, currentRate - 0.5),
    capStrike: currentRate + 0.5,
    capPremium: notional * 0.005,
    collarCap: currentRate + 0.5,
    collarFloor: Math.max(0, currentRate - 1.0),
    collarPremium: notional * 0.002,
    rateScenario: Array.from({ length: Math.ceil(termYears) }, () => currentRate),
  };

  return compareHedgingStrategies(input);
}
