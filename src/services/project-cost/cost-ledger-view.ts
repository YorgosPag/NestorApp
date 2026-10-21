/**
 * Cost Ledger View — the wire shape every reader of the ledger receives (ADR-917 Φ2).
 *
 * Pure, client-safe. Turns `CostLedger` into what a screen or the AI can read
 * without re-deriving anything:
 * - `budget: null` when the code has no BOQ line — «no source», never 0 € (Δ2).
 * - `projected` = committed + pending (Procore «Projected Costs»; Φ4 adds direct costs).
 * - `variance` = projected − budget, positive = over budget; `null` without a budget source.
 * - Totals compare like with like: money under codes WITHOUT a budget is reported
 *   apart (`unbudgetedProjected`), never silently added on one side only.
 *
 * @module services/project-cost/cost-ledger-view
 * @see ADR-917 §4 Δ2/Δ3
 */

import type { CostLedger, CostLedgerRow, CostLedgerSources } from './cost-ledger';

// ============================================================================
// TYPES
// ============================================================================

export interface CostLedgerViewRow {
  costCode: string;
  /** Σ BOQ — `null` ⇒ no BOQ line under this code (no source, NOT zero) */
  budget: number | null;
  pending: number;
  committed: number;
  delivered: number;
  projected: number;
  /** projected − budget; `null` ⇒ nothing to compare against */
  variance: number | null;
  boqItemCount: number;
  coveredBoqItemCount: number;
  /** Omitted when the reader asked for figures only (AI context) */
  sources?: CostLedgerSources;
}

export interface CostLedgerViewTotals {
  /** Σ budget over codes WITH a source; `null` when no code has one */
  budget: number | null;
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
}

export interface ProjectCostLedgerView {
  projectId: string;
  /** `true` ⇒ neither BOQ nor orders exist: «nothing recorded yet», not «0 €» */
  isEmpty: boolean;
  rows: CostLedgerViewRow[];
  totals: CostLedgerViewTotals;
  completeness: CostLedgerCompleteness;
}

export interface CostLedgerViewOptions {
  /** Keep the per-row documents (screens: yes; AI context: no) */
  includeSources: boolean;
}

// ============================================================================
// DERIVATION
// ============================================================================

function hasBudgetSource(row: CostLedgerRow): boolean {
  return row.boqItemCount > 0;
}

function toViewRow(row: CostLedgerRow, options: CostLedgerViewOptions): CostLedgerViewRow {
  const projected = row.committed + row.pending;
  const budget = hasBudgetSource(row) ? row.budget : null;
  const viewRow: CostLedgerViewRow = {
    costCode: row.categoryCode,
    budget,
    pending: row.pending,
    committed: row.committed,
    delivered: row.delivered,
    projected,
    variance: budget === null ? null : projected - budget,
    boqItemCount: row.boqItemCount,
    coveredBoqItemCount: row.coveredBoqItemCount,
  };
  if (options.includeSources) viewRow.sources = row.sources;
  return viewRow;
}

function toTotals(rows: readonly CostLedgerViewRow[]): CostLedgerViewTotals {
  let budget = 0;
  let projected = 0;
  let unbudgetedProjected = 0;
  let committed = 0;
  let delivered = 0;
  let anyBudget = false;
  for (const row of rows) {
    committed += row.committed;
    delivered += row.delivered;
    if (row.budget === null) {
      unbudgetedProjected += row.projected;
      continue;
    }
    anyBudget = true;
    budget += row.budget;
    projected += row.projected;
  }
  return {
    budget: anyBudget ? budget : null,
    projected,
    variance: anyBudget ? projected - budget : null,
    unbudgetedProjected,
    committed,
    delivered,
  };
}

function toCompleteness(ledger: CostLedger, rows: readonly CostLedgerViewRow[]): CostLedgerCompleteness {
  return {
    boqItemCount: ledger.boqItemCount,
    coveredBoqItemCount: ledger.coveredBoqItemCount,
    coveragePct: ledger.boqItemCount > 0
      ? Math.round((ledger.coveredBoqItemCount / ledger.boqItemCount) * 100)
      : null,
    codesWithoutBudget: rows.filter(row => row.budget === null && row.projected > 0).length,
  };
}

/** The one shaping of a ledger for readers (route, AI tool). */
export function toCostLedgerView(
  projectId: string,
  ledger: CostLedger,
  options: CostLedgerViewOptions,
): ProjectCostLedgerView {
  const rows = ledger.rows
    .filter(row => hasBudgetSource(row) || row.committed > 0 || row.pending > 0)
    .map(row => toViewRow(row, options));
  return {
    projectId,
    isEmpty: rows.length === 0,
    rows,
    totals: toTotals(rows),
    completeness: toCompleteness(ledger, rows),
  };
}
