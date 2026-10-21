/**
 * Cost Ledger — budget resolution per cost code (ADR-917 Φ3α · Ζ4 · Ζ7 · Ζ8)
 *
 * Pure. Decides WHICH document stands behind a row's budget, in one place:
 * 1. `SOFT-*` with budget lines → the lines (`soft`).
 * 2. A signed-off BOQ baseline (≥1 frozen line, NONE of them unpriced) → the BOQ (`boq`).
 * 3. Else a project budget line on the code → the allowance (`allowance`); a priced BOQ
 *    meanwhile is the «estimate accuracy» (`estimateDelta`), never added on top.
 * 4. Else priced BOQ lines (draft take-off) → `boq`.
 * 5. Else → `null`: no source. `unpricedBoqItemCount` says why, when it is the reason.
 *
 * Above Procore: there, consuming an allowance is a manual pair of entries
 * (−allowance / +commitment). Here it yields by itself, and the row names its source.
 *
 * @module services/project-cost/cost-ledger-budget
 * @see ADR-917
 */

import { costCodeFamilyOf } from '@/config/cost-taxonomy';

// ============================================================================
// TYPES
// ============================================================================

/** Which document stands behind a row's budget; `null` ⇒ none (never read as 0 €) */
export type CostLedgerBudgetSource = 'boq' | 'allowance' | 'soft';

/** One project budget line (Ζ8: one per project + code; net of VAT, Ζ5) */
export interface LedgerBudgetLine {
  id: string;
  /** `SOFT-*` (soft cost) or an ΑΤΟΕ code (allowance); 2nd level rolls up */
  costCode: string;
  amount: number;
  note: string | null;
}

/** The figures the resolution reads — accumulated by the ledger */
export interface BudgetEvidence {
  categoryCode: string;
  /** Σ cost of PRICED BOQ lines (any status) */
  boqAmount: number;
  pricedBoqItemCount: number;
  frozenBoqItemCount: number;
  frozenUnpricedBoqItemCount: number;
  /** Σ project budget lines; `null` ⇒ no line on this code */
  budgetLinesAmount: number | null;
}

export interface ResolvedBudget {
  budgetSource: CostLedgerBudgetSource | null;
  /** Meaningful only when `budgetSource !== null` */
  budget: number;
  /** BOQ − allowance while the allowance still stands; `null` otherwise */
  estimateDelta: number | null;
}

// ============================================================================
// RESOLUTION
// ============================================================================

/** Ζ4 — the allowance yields only to a fully priced, signed-off baseline. */
function hasSignedOffPricedBaseline(evidence: BudgetEvidence): boolean {
  return evidence.frozenBoqItemCount > 0 && evidence.frozenUnpricedBoqItemCount === 0;
}

export function resolveRowBudget(evidence: BudgetEvidence): ResolvedBudget {
  const lines = evidence.budgetLinesAmount;
  if (lines !== null && costCodeFamilyOf(evidence.categoryCode) === 'soft') {
    return { budgetSource: 'soft', budget: lines, estimateDelta: null };
  }
  if (hasSignedOffPricedBaseline(evidence)) {
    return { budgetSource: 'boq', budget: evidence.boqAmount, estimateDelta: null };
  }
  if (lines !== null) {
    const estimateDelta = evidence.pricedBoqItemCount > 0 ? evidence.boqAmount - lines : null;
    return { budgetSource: 'allowance', budget: lines, estimateDelta };
  }
  if (evidence.pricedBoqItemCount > 0) {
    return { budgetSource: 'boq', budget: evidence.boqAmount, estimateDelta: null };
  }
  return { budgetSource: null, budget: 0, estimateDelta: null };
}
