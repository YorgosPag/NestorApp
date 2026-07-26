'use client';

import '@/lib/design-system';

/**
 * Monte Carlo chart components — fan chart, histogram, and the statistics grid.
 *
 * Both plots render through the ADR-710 chart card shell.
 *
 * ## Why the percentile bands are polarity colors, not five categorical hues
 *
 * P10…P90 are not five unrelated categories: they are one measure seen at five points
 * of its distribution, and the two ends carry opposite meaning — a high NPV is the good
 * outcome, a low one the bad. So the bands read `chartPolarityColor`, with the median
 * left neutral, and separation inside each half comes from fill opacity. The five
 * literal hues this file used to carry ignored the theme entirely and were the reason
 * for the two eslint suppressions at its top, both now gone.
 *
 * @enterprise ADR-242 SPEC-242D — Monte Carlo Simulation
 * @enterprise ADR-710 — Chart card shell
 * @module monte-carlo-charts
 */

import { useCallback, useMemo } from 'react';
import { AreaChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, ComposedChart } from 'recharts';

import { InfoDt } from '@/components/ui/InfoLabel';
import {
  CHART_POLARITY_COLORS,
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { formatCurrencyCompact, formatCurrencyWhole, formatPercentage } from '@/lib/intl-utils';
import { financialAxisFrame } from './financial-chart-axes';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FanChartPoint, HistogramBin, MonteCarloResult } from '@/types/interest-calculator';
import type { HelpMetricKey, HoveredItem, MonteCarloTabProps } from './monte-carlo-helpers';

// =============================================================================
// SHARED
// =============================================================================

type TranslateFn = MonteCarloTabProps['t'];

/** Bands, outermost first — the draw order that lets the inner ones stay visible. */
const FAN_BANDS = [
  { key: 'p90', labelKey: 'p90', tone: CHART_POLARITY_COLORS.good, opacity: 0.12 },
  { key: 'p75', labelKey: 'p75', tone: CHART_POLARITY_COLORS.good, opacity: 0.18 },
  { key: 'p50', labelKey: 'p50', tone: CHART_POLARITY_COLORS.neutral, opacity: 0.25 },
  { key: 'p25', labelKey: 'p25', tone: CHART_POLARITY_COLORS.bad, opacity: 0.18 },
  { key: 'p10', labelKey: 'p10', tone: CHART_POLARITY_COLORS.bad, opacity: 0.12 },
] as const satisfies readonly {
  key: Extract<keyof FanChartPoint, string>;
  labelKey: string;
  tone: string;
  opacity: number;
}[];

// =============================================================================
// STATISTICS CARD
// =============================================================================

/** Grid of key Monte Carlo result statistics with hover-to-explain support */
export function StatisticsCard({
  mcResult,
  t,
  onHover,
}: {
  mcResult: MonteCarloResult;
  t: TranslateFn;
  onHover: (item: HoveredItem | null) => void;
}) {
  const colors = useSemanticColors();
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  const cardClass =
    'rounded-lg border p-3 space-y-1 transition-colors hover:border-primary/40 hover:bg-[hsl(var(--bg-info))]/20 cursor-help';

  const enter = (key: HelpMetricKey) => () => onHover({ source: 'metric', key });
  const leave = () => onHover(null);

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <dl className={cardClass} onMouseEnter={enter('meanNpv')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.meanNpv')} tooltip={t('costCalculator.monteCarlo.meanNpvTooltip')} className={cn("text-xs", colors.text.muted)} />
        <dd className="text-lg font-bold">{fmt(mcResult.meanNPV)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('p10')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.p10')} tooltip={t('costCalculator.monteCarlo.p10Tooltip')} className={cn("text-xs", colors.text.muted)} />
        <dd className="text-lg font-bold">{fmt(mcResult.p10)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('p50')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.p50')} tooltip={t('costCalculator.monteCarlo.p50Tooltip')} className={cn("text-xs", colors.text.muted)} />
        <dd className="text-lg font-bold">{fmt(mcResult.p50)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('p90')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.p90')} tooltip={t('costCalculator.monteCarlo.p90Tooltip')} className={cn("text-xs", colors.text.muted)} />
        <dd className="text-lg font-bold">{fmt(mcResult.p90)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('stdDev')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.stdDevNpv')} tooltip={t('costCalculator.monteCarlo.stdDevNpvTooltip')} className={cn("text-xs", colors.text.muted)} />
        <dd className="text-sm font-medium">{fmt(mcResult.stdDevNPV)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('minMax')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.minMax')} tooltip={t('costCalculator.monteCarlo.minMaxTooltip')} className={cn("text-xs", colors.text.muted)} />
        <dd className="text-sm font-medium">{fmt(mcResult.minNPV)} — {fmt(mcResult.maxNPV)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('probPositive')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.probPositive')} tooltip={t('costCalculator.monteCarlo.probPositiveTooltip')} className={cn("text-xs", colors.text.muted)} />
        <dd className="text-sm font-medium">{formatPercentage(mcResult.probPositive)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('executionTime')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.executionTime')} tooltip={t('costCalculator.monteCarlo.executionTimeTooltip')} className={cn("text-xs", colors.text.muted)} />
        <dd className="text-sm font-medium">{mcResult.executionTimeMs}ms</dd>
      </dl>
    </section>
  );
}

// =============================================================================
// FAN CHART
// =============================================================================

/** Fan chart showing P10-P90 confidence bands over time */
export function FanChart({ mcResult, t }: { mcResult: MonteCarloResult; t: TranslateFn }) {
  const series = useMemo<ChartSeries<FanChartPoint>[]>(
    () =>
      FAN_BANDS.map((band) => ({
        key: band.key,
        label: t(`costCalculator.monteCarlo.${band.labelKey}`),
        color: band.tone,
      })),
    [t],
  );

  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value) ?? '', []);

  return (
    <ChartCard
      series={series}
      data={mcResult.fanChart}
      categoryKey="month"
      categoryLabel={t('costCalculator.monteCarlo.month')}
      formatValue={formatEuro}
    >
      <ChartCard.Header title={t('costCalculator.monteCarlo.fanChartTitle')} />
      <ChartCard.Figure
        caption={t('costCalculator.monteCarlo.fanChartLegend')}
        emptyMessage={t('costCalculator.monteCarlo.fanChartEmptyState')}
        size="lg"
      >
        <AreaChart data={mcResult.fanChart}>
          {financialAxisFrame({ categoryKey: 'month' })}
          {FAN_BANDS.map((band) => (
            <Area
              key={band.key}
              type="monotone"
              dataKey={band.key}
              // Each band is drawn from the baseline rather than on top of the one
              // before it, so a band never inherits the height of its neighbour.
              stackId={band.key}
              stroke={band.key === 'p50' ? seriesColorVar(band.key) : 'none'}
              strokeWidth={band.key === 'p50' ? 2 : undefined}
              fill={seriesColorVar(band.key)}
              fillOpacity={band.opacity}
            />
          ))}
        </AreaChart>
      </ChartCard.Figure>
    </ChartCard>
  );
}

// =============================================================================
// HISTOGRAM + CDF
// =============================================================================

/** Histogram of NPV distribution with CDF overlay line */
export function HistogramChart({ mcResult, t }: { mcResult: MonteCarloResult; t: TranslateFn }) {
  const series = useMemo<ChartSeries<HistogramBin>[]>(
    () => [
      { key: 'frequency', label: t('costCalculator.monteCarlo.frequency') },
      { key: 'cumulativeFrequency', label: t('costCalculator.monteCarlo.cdf') },
    ],
    [t],
  );

  /** Both series are shares of the scenario count, so both read as percentages. */
  const formatShare = useCallback((value: number) => formatPercentage(value * 100), []);
  const formatBin = useCallback(
    (value: unknown) => formatCurrencyWhole(Number(value)) ?? '',
    [],
  );

  return (
    <ChartCard
      series={series}
      data={mcResult.histogram}
      categoryKey="midpoint"
      categoryLabel={t('costCalculator.monteCarlo.npvEuro')}
      formatValue={formatShare}
      formatCategory={formatBin}
    >
      <ChartCard.Header title={t('costCalculator.monteCarlo.histogramTitle')} />
      <ChartCard.Figure
        caption={t('costCalculator.monteCarlo.histogramLegend')}
        emptyMessage={t('costCalculator.monteCarlo.histogramEmptyState')}
        size="lg"
      >
        <ComposedChart data={mcResult.histogram}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="midpoint"
            tickFormatter={formatCurrencyCompact}
            tickLine={false}
            axisLine={false}
          />
          {/* Two scales, because a bin holds a few percent of the scenarios while the
              cumulative line always ends at 100 — sharing one axis would flatten the
              bars into the baseline. */}
          <YAxis
            yAxisId="frequency"
            tickFormatter={formatShare}
            width={64}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            tickFormatter={formatShare}
            width={64}
            tickLine={false}
            axisLine={false}
          />
          <ChartCard.Tooltip />
          <Bar
            yAxisId="frequency"
            dataKey="frequency"
            fill={seriesColorVar('frequency')}
            opacity={0.7}
          />
          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulativeFrequency"
            stroke={seriesColorVar('cumulativeFrequency')}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartCard.Figure>
    </ChartCard>
  );
}
