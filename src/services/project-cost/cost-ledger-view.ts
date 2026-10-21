/**
 * Cost Ledger View — the wire shape every reader of the ledger receives (ADR-917 Φ2 · Φ3α).
 *
 * Pure, client-safe. Turns `CostLedger` into what a screen or the AI can read
 * without re-deriving anything:
 * - `budget: null` ⇔ `budgetSource: null` — «no source», never 0 € (Δ2). An unpriced
 *   BOQ line is not a source either (Ζ7): `unpricedBoqItemCount` says why.
 * - `projected` = committed + pending (Procore «Projected Costs»; Φ4 adds direct costs).
 * - `variance` = projected − budget, positive = over budget; `null` without a budget source.
 * - Totals compare like with like: money under codes WITHOUT a budget is reported
 *   apart (`unbudgetedProjected`), never silently added on one side only.
 * - Land given in exchange (αντιπαροχή, Ζ2) is shown IN KIND, outside every total.
 *
 * @module services/project-cost/cost-ledger-view
 * @see ADR-917 §4 Δ2/Δ3 · Ζ2 · Ζ7
 */

import { costCodeFamilyOf } from '@/config/cost-taxonomy';
import type { CostLedger, CostLedgerBudgetSource, CostLedgerRow, CostLedgerSources } from './cost-ledger';

// ============================================================================
// TYPES
// ============================================================================

export interface CostLedgerViewRow {
  costCode: string;
  /** Which document stands behind `budget`; `null` ⇒ no source */
  budgetSource: CostLedgerBudgetSource | null;
  /** `null` ⇒ no source under this code (NOT zero) */
  budget: number | null;
  /** Σ project budget lines (allowance on ΑΤΟΕ, soft cost on SOFT-*); `null` ⇒ none */
  budgetLinesAmount: number | null;
  /** BOQ − allowance while the allowance stands («estimate accuracy»); `null` otherwise */
  estimateDelta: number | null;
  pending: number;
  committed: number;
  delivered: number;
  projected: number;
  /** projected − budget; `null` ⇒ nothing to compare against */
  variance: number | null;
  boqItemCount: number;
  unpricedBoqItemCount: number;
  coveredBoqItemCount: number;
  /** Omitted when the reader asked for figures only (AI context) */
  sources?: CostLedgerSources;
}

export interface CostLedgerViewTotals {
  /** Σ budget over codes WITH a source; `null` when no code has one */
  budget: number | null;
  /** The soft-cost part of `budget` (SOFT-*) — so hard and soft read apart */
  softBudget: number;
  /** Σ projected over the same codes as `budget` */
  projected: number;
  variance: number | null;
  /** Projected money under codes with NO budget source — shown apart, not mixed in */
  unbudgetedProjected: number;
  committed: number;
  delivered: number;
}

export interface CostLedgerCompleteness {
  boqItemCount: number;
  coveredBoqItemCount: number;
  /** Committed coverage of BOQ lines; `null` when there is no BOQ at all */
  coveragePct: number | null;
  /** Codes that carry money but no budget source */
  codesWithoutBudget: number;
  /** BOQ lines with no unit price yet (Ζ7) */
  unpricedBoqItemCount: number;
  /** Codes whose budget still rests on an allowance, not on a signed-off BOQ (Ζ4) */
  allowanceCodes: number;
}

/** Ζ2 — the landowner's share, valued in kind; NEVER part of `totals` */
export interface CostLedgerLandExchange {
  bartexPercentage: number;
  /** % × current hard budget (Φ6 swaps in the hard EAC) */
  inKindValue: number;
  /** What the value is computed on — said explicitly, it is an estimate */
  basis: 'current-hard-budget';
}

export interface ProjectCostLedgerView {
  projectId: string;
  /** `true` ⇒ no BOQ, no orders, no budget lines: «nothing recorded yet», not «0 €» */
  isEmpty: boolean;
  rows: CostLedgerViewRow[];
  totals: CostLedgerViewTotals;
  completeness: CostLedgerCompleteness;
  landExchange: CostLedgerLandExchange | null;
}

export interface CostLedgerViewOptions {
  /** Keep the per-row documents (screens: yes; AI context: no) */
  includeSources: boolean;
  /** `Project.bartexPercentage` (ADR-244) when the project runs on αντιπαροχή */
  bartexPercentage?: number | null;
}

/**
 * `Project.bartexPercentage` from a raw project document — the ONE reader for the route and the AI tool.
 * Anything that is not a percentage in (0, 100] ⇒ `null`: no in-kind figure from a value nobody set.
 */
export function bartexPercentageOf(project: unknown): number | null {
  if (typeof project !== 'object' || project === null) return null;
  const value = (project as { bartexPercentage?: unknown }).bartexPercentage;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100 ? value : null;
}

// ============================================================================
// DERIVATION
// ============================================================================

function isShown(row: CostLedgerRow): boolean {
  return row.budgetSource !== null || row.committed > 0 || row.pending > 0 || row.boqItemCount > 0;
}

function toViewRow(row: CostLedgerRow, options: CostLedgerViewOptions): CostLedgerViewRow {
  const projected = row.committed + row.pending;
  const budget = row.budgetSource === null ? null : row.budget;
  const viewRow: CostLedgerViewRow = {
    costCode: row.categoryCode,
    budgetSource: row.budgetSource,
    budget,
    budgetLinesAmount: row.budgetLinesAmount,
    estimateDelta: row.estimateDelta,
    pending: row.pending,
    committed: row.committed,
    delivered: row.delivered,
    projected,
    variance: budget === null ? null : projected - budget,
    boqItemCount: row.boqItemCount,
    unpricedBoqItemCount: row.unpricedBoqItemCount,
    coveredBoqItemCount: row.coveredBoqItemCount,
  };
  if (options.includeSources) viewRow.sources = row.sources;
  return viewRow;
}

function toTotals(rows: readonly CostLedgerViewRow[]): CostLedgerViewTotals {
  const totals: CostLedgerViewTotals = {
    budget: null, softBudget: 0, projected: 0, variance: null, unbudgetedProjected: 0, committed: 0, delivered: 0,
  };
  let budget = 0;
  for (const row of rows) {
    totals.committed += row.committed;
    totals.delivered += row.delivered;
    if (row.budget === null) {
      totals.unbudgetedProjected += row.projected;
      continue;
    }
    budget += row.budget;
    totals.budget = budget;
    totals.projected += row.projected;
    if (costCodeFamilyOf(row.costCode) === 'soft') totals.softBudget += row.budget;
  }
  totals.variance = totals.budget === null ? null : totals.projected - totals.budget;
  return totals;
}

function toCompleteness(ledger: CostLedger, rows: readonly CostLedgerViewRow[]): CostLedgerCompleteness {
  return {
    boqItemCount: ledger.boqItemCount,
    coveredBoqItemCount: ledger.coveredBoqItemCount,
    coveragePct: ledger.boqItemCount > 0
      ? Math.round((ledger.coveredBoqItemCount / ledger.boqItemCount) * 100)
      : null,
    codesWithoutBudget: rows.filter(row => row.budget === null && row.projected > 0).length,
    unpricedBoqItemCount: rows.reduce((sum, row) => sum + row.unpricedBoqItemCount, 0),
    allowanceCodes: rows.filter(row => row.budgetSource === 'allowance').length,
  };
}

function toLandExchange(
  rows: readonly CostLedgerViewRow[],
  bartexPercentage: number | null | undefined,
): CostLedgerLandExchange | null {
  if (bartexPercentage === null || bartexPercentage === undefined || bartexPercentage <= 0) return null;
  const hardBudget = rows
    .filter(row => row.budget !== null && costCodeFamilyOf(row.costCode) === 'atoe')
    .reduce((sum, row) => sum + (row.budget ?? 0), 0);
  return { bartexPercentage, inKindValue: (bartexPercentage / 100) * hardBudget, basis: 'current-hard-budget' };
}

/** The one shaping of a ledger for readers (route, AI tool). */
export function toCostLedgerView(
  projectId: string,
  ledger: CostLedger,
  options: CostLedgerViewOptions,
): ProjectCostLedgerView {
  const rows = ledger.rows.filter(isShown).map(row => toViewRow(row, options));
  return {
    projectId,
    isEmpty: rows.length === 0,
    rows,
    totals: toTotals(rows),
    completeness: toCompleteness(ledger, rows),
    landExchange: toLandExchange(rows, options.bartexPercentage),
  };
}
