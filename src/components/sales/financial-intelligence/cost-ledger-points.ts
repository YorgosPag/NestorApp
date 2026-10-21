/**
 * Cost ledger → chart points, with the SOURCE of every budget bar (ADR-917 Φ3γ).
 *
 * Pure. The source is read from the ledger view (`budgetSource`), never inferred from the figure. It reaches
 * the human through three channels, none of them colour alone (CHECK 3.41): the category text of the tooltip
 * and the data table («Concrete · source: allowance»), and a dashed outline on an allowance (estimate) bar.
 *
 * @module components/sales/financial-intelligence/cost-ledger-points
 * @see ADR-917 §4 Δ2 · Ζ4′
 */

import { costCodeLabelKey } from '@/config/cost-taxonomy';
import type { CostLedgerBudgetSource } from '@/services/project-cost/cost-ledger';
import type { CostLedgerViewRow } from '@/services/project-cost/cost-ledger-view';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface LedgerPoint {
  costCode: string;
  label: string;
  budget: number | null;
  budgetSource: CostLedgerBudgetSource | null;
  projected: number;
}

export function costCodeLabel(costCode: string, t: Translate): string {
  return t(costCodeLabelKey(costCode));
}

export function toLedgerPoints(rows: readonly CostLedgerViewRow[], t: Translate): LedgerPoint[] {
  return rows.map((row) => ({
    costCode: row.costCode,
    label: costCodeLabel(row.costCode, t),
    budget: row.budget,
    budgetSource: row.budgetSource,
    projected: row.projected,
  }));
}

/** «χωρίς πηγή» is a source too — said, never left blank. */
export function budgetSourceText(source: CostLedgerBudgetSource | null, t: Translate): string {
  return t(`variance.source.kind.${source ?? 'none'}`);
}

/** The category as tooltip / data table / screen reader say it: the code's label AND its budget source. */
export function ledgerCategoryText(point: LedgerPoint, t: Translate): string {
  return t('variance.source.categoryWithSource', { label: point.label, source: budgetSourceText(point.budgetSource, t) });
}

/** An allowance is an estimate: its bar is drawn dashed (the legend says so only when one is on screen). */
export function isEstimateBar(point: LedgerPoint): boolean {
  return point.budgetSource === 'allowance';
}
