'use client';

/**
 * Equity waterfall results — the headline figures and the per-tier split.
 *
 * The stacked bar renders through the ADR-710 chart card shell, which also owns the
 * per-tier table. The hand-built breakdown table that used to sit under the plot is
 * gone: it listed the same tier/LP/GP numbers the shell derives from the series
 * description, and its totals row said what the summary cards above already say. Its
 * column headings were also the last untranslated English in this dialog.
 *
 * @enterprise ADR-242 SPEC-242D — Equity Waterfall Distribution
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useMemo } from 'react';
import { BarChart, Bar } from 'recharts';

import {
  CHART_STACK_SPACER,
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { financialAxisFrame } from './financial-chart-axes';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { WaterfallResult } from '@/types/interest-calculator';
import { InfoDt } from '@/components/ui/InfoLabel';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

type TranslateFn = (key: string) => string;

interface WaterfallTierPoint {
  name: string;
  lp: number;
  gp: number;
}

interface EquityWaterfallResultsProps {
  readonly result: WaterfallResult;
  readonly t: TranslateFn;
}

// =============================================================================
// DERIVATIONS
// =============================================================================

/** Only tiers that actually distributed something are plotted. */
function buildChartData(result: WaterfallResult): WaterfallTierPoint[] {
  return result.tiers
    .filter((tier) => tier.totalAmount > 0)
    .map((tier) => ({ name: tier.name, lp: tier.lpAmount, gp: tier.gpAmount }));
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EquityWaterfallResults({ result, t }: EquityWaterfallResultsProps) {
  const chartData = useMemo(() => buildChartData(result), [result]);

  const series = useMemo<ChartSeries<WaterfallTierPoint>[]>(
    () => [
      { key: 'lp', label: t('costCalculator.waterfall.lpShareLabel') },
      { key: 'gp', label: t('costCalculator.waterfall.gpShareLabel') },
    ],
    [t],
  );

  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value) ?? '', []);

  return (
    <section className="space-y-6">
      <h3 className="text-sm font-semibold">{t('costCalculator.waterfall.resultsTitle')}</h3>

      <WaterfallHeadlines result={result} t={t} />

      <ChartCard
        series={series}
        data={chartData}
        categoryKey="name"
        categoryLabel={t('costCalculator.waterfall.tier')}
        formatValue={formatEuro}
      >
        <ChartCard.Header title={t('costCalculator.waterfall.tierBreakdown')} />
        <ChartCard.Figure
          caption={t('costCalculator.waterfall.chartCaption')}
          emptyMessage={t('costCalculator.waterfall.chartEmptyState')}
        >
          <BarChart layout="vertical" data={chartData} margin={{ left: 100 }}>
            {financialAxisFrame({ categoryKey: 'name', layout: 'vertical' })}
            <Bar dataKey="lp" stackId="tier" fill={seriesColorVar('lp')} {...CHART_STACK_SPACER} />
            <Bar dataKey="gp" stackId="tier" fill={seriesColorVar('gp')} {...CHART_STACK_SPACER} />
          </BarChart>
        </ChartCard.Figure>
      </ChartCard>
    </section>
  );
}

// =============================================================================
// HEADLINE FIGURES
// =============================================================================

/** One figure and the sentence that explains what it means. */
function Headline({
  label,
  tooltip,
  value,
  emphasis,
}: {
  readonly label: string;
  readonly tooltip: string;
  readonly value: string;
  readonly emphasis?: string;
}) {
  const colors = useSemanticColors();
  return (
    <dl className="space-y-1 rounded-lg border p-3">
      <InfoDt label={label} tooltip={tooltip} className={cn('text-xs', colors.text.muted)} />
      <dd className={cn('text-lg font-bold', emphasis)}>{value}</dd>
    </dl>
  );
}

function WaterfallHeadlines({ result, t }: EquityWaterfallResultsProps) {
  const fmt = (value: number) => formatCurrencyWhole(value) ?? '';
  const key = (name: string) => `costCalculator.waterfall.${name}`;

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Headline
        label={t(key('lpTotal'))}
        tooltip={t(key('lpTotalTooltip'))}
        value={fmt(result.totalLP)}
        emphasis="text-primary"
      />
      <Headline
        label={t(key('gpTotal'))}
        tooltip={t(key('gpTotalTooltip'))}
        value={fmt(result.totalGP)}
        emphasis="text-[hsl(var(--text-success))]"
      />
      <Headline
        label={t(key('lpMultiple'))}
        tooltip={t(key('lpMultipleTooltip'))}
        value={`${result.lpMultiple}x`}
      />
      <Headline
        label={t(key('gpMultiple'))}
        tooltip={t(key('gpMultipleTooltip'))}
        value={`${result.gpMultiple}x`}
      />
      <Headline
        label={t(key('lpIrr'))}
        tooltip={t(key('lpIrrTooltip'))}
        value={`${result.lpIRR}%`}
      />
      <Headline
        label={t(key('gpIrr'))}
        tooltip={t(key('gpIrrTooltip'))}
        value={`${result.gpIRR}%`}
      />
      {result.remainder > 0 ? (
        <Headline
          label={t(key('remainder'))}
          tooltip={t(key('remainderTooltip'))}
          value={fmt(result.remainder)}
          emphasis="text-[hsl(var(--text-warning))]"
        />
      ) : null}
    </section>
  );
}
