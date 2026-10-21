'use client';

/**
 * CostLedgerSummary — the totals of the budget card, compared like with like, with completeness ALWAYS
 * stated (ADR-917 Φ2 · Φ3γ).
 *
 * Besides the figures it says what is missing or set apart: money under codes without a budget, unpriced
 * BOQ lines (Ζ7), land exchange valued in kind and kept out of every total (Ζ2), wall summaries left out of
 * the sum because their layers count (Λ7), and legacy group parents whose role cannot be proven (Λ7 —
 * counted, so the total may double-count: said, never hidden).
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
    </ChartCard.Summary>
  );
}
