'use client';

/**
 * CostLedgerSummary — the totals of the budget card, compared like with like, with completeness ALWAYS
 * stated (ADR-917 Φ2 · Φ3γ).
 *
 * Besides the figures it says what is missing or set apart: money under codes without a budget, unpriced
 * BOQ lines (Ζ7), land exchange valued in kind and kept out of every total (Ζ2), wall summaries left out of
 * the sum because their layers count (Λ7), and legacy group parents whose role cannot be proven (Λ7 —
 * counted, so the total may double-count: said, never hidden). Φ4: invoiced from confirmed expense documents —
 * «no allocated document» is said in words, never shown as 0 €; documents in review, partly allocated or not
 * allocated at all are declared.
 *
 * @module components/sales/financial-intelligence/CostLedgerSummary
 */

import { ChartCard, chartPolarityTone } from '@/components/ui/chart-card';
import type { ProjectCostLedgerView } from '@/services/project-cost/cost-ledger-view';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Spending above plan is the bad direction — see `chartPolarityTone`. */
const VARIANCE_POLARITY = 'lower-is-better' as const;

interface CostLedgerSummaryProps {
  ledger: ProjectCostLedgerView;
  format: (value: number) => string;
  t: Translate;
}

function formatSigned(value: number, format: (value: number) => string): string {
  return `${value > 0 ? '+' : ''}${format(value)}`;
}

function TotalsItems({ ledger, format, t }: CostLedgerSummaryProps) {
  const { totals, completeness } = ledger;
  return (
    <>
      <ChartCard.SummaryItem
        label={t('variance.totalBudget')}
        value={totals.budget === null ? t('variance.source.noBudget') : format(totals.budget)}
      />
      <ChartCard.SummaryItem label={t('variance.source.projected')} value={format(totals.projected)} />
      <ChartCard.SummaryItem
        label={t('variance.source.invoiced')}
        value={totals.invoiced === null ? t('variance.source.noInvoiced') : format(totals.invoiced)}
      />
      {totals.directCost > 0 ? (
        <ChartCard.SummaryItem label={t('variance.source.directCost')} value={format(totals.directCost)} />
      ) : null}
      {totals.variance !== null ? (
        <ChartCard.SummaryItem
          label={t('variance.totalVariance')}
          value={formatSigned(totals.variance, format)}
          tone={chartPolarityTone(totals.variance, VARIANCE_POLARITY)}
        />
      ) : null}
      {totals.unbudgetedProjected > 0 ? (
        <ChartCard.SummaryItem
          label={t('variance.source.unbudgeted')}
          value={`${format(totals.unbudgetedProjected)} · ${t('variance.source.codesWithoutBudget', { count: completeness.codesWithoutBudget })}`}
          tone="bad"
        />
      ) : null}
    </>
  );
}

/** Φ4 — what «invoiced» does NOT yet contain, each said by count */
function ExpenseCompletenessItems({ ledger, t }: Pick<CostLedgerSummaryProps, 'ledger' | 't'>) {
  const { expenses } = ledger.completeness;
  return (
    <>
      {expenses.inReviewDocumentCount > 0 ? (
        <ChartCard.SummaryItem label={t('variance.source.expensesInReviewLabel')} value={t('variance.source.expensesInReview', { count: expenses.inReviewDocumentCount })} tone="bad" />
      ) : null}
      {expenses.partiallyAllocatedDocumentCount > 0 ? (
        <ChartCard.SummaryItem label={t('variance.source.expensesPartialLabel')} value={t('variance.source.expensesPartial', { count: expenses.partiallyAllocatedDocumentCount })} tone="bad" />
      ) : null}
      {expenses.awaitingAllocationCount > 0 ? (
        <ChartCard.SummaryItem label={t('variance.source.expensesAwaitingLabel')} value={t('variance.source.expensesAwaiting', { count: expenses.awaitingAllocationCount })} tone="bad" />
      ) : null}
    </>
  );
}

function CompletenessItems({ ledger, format, t }: CostLedgerSummaryProps) {
  const { completeness, landExchange } = ledger;
  const coverage = completeness.coveragePct === null ? t('variance.source.noBoq') : `${completeness.coveragePct}%`;
  return (
    <>
      {completeness.unpricedBoqItemCount > 0 ? (
        <ChartCard.SummaryItem label={t('variance.source.unpricedLabel')} value={t('variance.source.unpriced', { count: completeness.unpricedBoqItemCount })} tone="bad" />
      ) : null}
      {landExchange ? (
        <ChartCard.SummaryItem
          label={t('variance.source.landExchangeLabel')}
          value={t('variance.source.landExchange', { value: format(landExchange.inKindValue), percentage: landExchange.bartexPercentage })}
        />
      ) : null}
      {completeness.excludedSummaryCount > 0 ? (
        <ChartCard.SummaryItem label={t('variance.source.excludedSummariesLabel')} value={t('variance.source.excludedSummaries', { count: completeness.excludedSummaryCount })} />
      ) : null}
      {completeness.unresolvedGroupRoleCount > 0 ? (
        <ChartCard.SummaryItem label={t('variance.source.unresolvedRolesLabel')} value={t('variance.source.unresolvedRoles', { count: completeness.unresolvedGroupRoleCount })} tone="bad" />
      ) : null}
      <ChartCard.SummaryItem label={t('variance.source.coverage')} value={coverage} />
    </>
  );
}

export function CostLedgerSummary(props: CostLedgerSummaryProps) {
  return (
    <ChartCard.Summary>
      <TotalsItems {...props} />
      <CompletenessItems {...props} />
      <ExpenseCompletenessItems ledger={props.ledger} t={props.t} />
    </ChartCard.Summary>
  );
}
