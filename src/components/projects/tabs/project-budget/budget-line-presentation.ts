/**
 * Budget line on screen — its label and what it does in the ledger (ADR-917 Φ3γ · Α30).
 *
 * Pure. The «effect» is NOT re-derived: it is read from the ledger view row of the line's group — the same
 * core (`resolveRowBudget`, Ζ4′/Ζ8) the card and the AI read. Procore shows an allowance as a figure; here
 * the human sees whether it still counts or has stepped aside for the signed-off bill of quantities.
 *
 * @module components/projects/tabs/project-budget/budget-line-presentation
 * @see ADR-917 Ζ4′ · Ζ8
 */

import { costCodeFamilyOf, costCodeGroupOf, costCodeLabelParts } from '@/config/cost-taxonomy';
import { parseLocaleNumber } from '@/lib/number/locale-number';
import { BUDGET_LINE_MAX_AMOUNT, normalizeBudgetAmount } from '@/services/project-cost/budget-line-limits';
import type { ProjectCostLedgerView } from '@/services/project-cost/cost-ledger-view';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type BudgetLineFamily = 'allowance' | 'soft';

export type BudgetLineEffect =
  | { kind: 'allowanceActive'; estimateDelta: number | null }
  | { kind: 'superseded' }
  | { kind: 'soft' }
  | { kind: 'unknown' };

/** `OIK-*` lines are allowances, `SOFT-*` lines are soft cost — the family IS the kind (Ζ8). */
export function budgetLineFamilyOf(costCode: string): BudgetLineFamily {
  return costCodeFamilyOf(costCode) === 'soft' ? 'soft' : 'allowance';
}

export function budgetLineLabel(costCode: string, t: Translate): string {
  const { groupLabelKey, lowerLevel } = costCodeLabelParts(costCode);
  const group = t(groupLabelKey);
  return lowerLevel === null ? group : t('budgetEditor.codeWithLowerLevel', { group, lowerLevel });
}

/** What the line does right now, from the ledger row of its group; `unknown` until the ledger is read. */
export function budgetLineEffect(costCode: string, ledger: ProjectCostLedgerView | null): BudgetLineEffect {
  if (budgetLineFamilyOf(costCode) === 'soft') return { kind: 'soft' };
  const group = costCodeGroupOf(costCode);
  const row = ledger?.rows.find(candidate => candidate.costCode === group);
  if (!row) return { kind: 'unknown' };
  if (row.budgetSource === 'allowance') return { kind: 'allowanceActive', estimateDelta: row.estimateDelta };
  if (row.budgetSource === 'boq') return { kind: 'superseded' };
  return { kind: 'unknown' };
}

export type BudgetLineInvoiced =
  | { kind: 'unknown' }
  | { kind: 'none' }
  | { kind: 'amount'; amount: number; directCost: number };

/**
 * ADR-917 Φ4 — what the line's GROUP has been invoiced, read from the ledger row (never summed here). `none` ⇔
 * no confirmed allocated document (never «0 €»); `unknown` until the ledger is read.
 */
export function budgetLineInvoiced(costCode: string, ledger: ProjectCostLedgerView | null): BudgetLineInvoiced {
  if (ledger === null) return { kind: 'unknown' };
  const row = ledger.rows.find(candidate => candidate.costCode === costCodeGroupOf(costCode));
  if (!row || row.invoiced === null) return { kind: 'none' };
  return { kind: 'amount', amount: row.invoiced, directCost: row.directCost };
}

/**
 * Typed text → a net amount the server accepts (Ζ5: ≥ 0, cents), in either decimal convention
 * (`1.200,50` · `1,200.50`); `null` ⇒ the cell restores instead of sending a request that would be refused.
 */
export function parseBudgetAmount(text: string): number | null {
  const value = parseLocaleNumber(text);
  return value !== null && value >= 0 && value <= BUDGET_LINE_MAX_AMOUNT ? normalizeBudgetAmount(value) : null;
}
