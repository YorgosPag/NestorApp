/* eslint-disable design-system/no-hardcoded-colors */
/* eslint-disable design-system/enforce-semantic-colors */
 
'use client';

import '@/lib/design-system';

/**
 * Monte Carlo Chart Components — Fan chart, histogram, and statistics card
 *
 * Self-contained recharts-based visualization components for
 * Monte Carlo NPV simulation results.
 *
 * @enterprise ADR-242 SPEC-242D — Monte Carlo Simulation
 * @module monte-carlo-charts
 */

import React from 'react';
import {
  AreaChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { InfoDt } from '@/components/sales/payments/financial-intelligence/InfoLabel';
import { FinancialTooltip } from '@/components/sales/payments/financial-intelligence/FinancialTooltip';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { MonteCarloResult } from '@/types/interest-calculator';
import type { HelpMetricKey, HoveredItem, MonteCarloTabProps } from './monte-carlo-helpers';

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
  t: MonteCarloTabProps['t'];
  onHover: (item: HoveredItem | null) => void;
}) {
  const colors = useSemanticColors();
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  const cardClass =
    'rounded-lg border p-3 space-y-1 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-600 dark:hover:bg-blue-950/30 cursor-help';

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
        <dd className="text-sm font-medium">{mcResult.probPositive}%</dd>
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
export function FanChart({
  mcResult,
  t,
}: {
  mcResult: MonteCarloResult;
  t: MonteCarloTabProps['t'];
}) {
  const colors = useSemanticColors();
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  if (mcResult.fanChart.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.fanChartTitle')}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={mcResult.fanChart} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="month"
            label={{ value: 'Month', position: 'insideBottomRight', offset: -5 }}
          />
          <YAxis tickFormatter={(v: number) => fmt(v)} />
          <Tooltip
            content={
              <FinancialTooltip valueFormatter={(value, name) => [fmt(value as number), name]} />
            }
          />
          <Area type="monotone" dataKey="p90" stackId="band" stroke="none" fill="hsl(142, 71%, 45%)" fillOpacity={0.12} name="P90" />
          <Area type="monotone" dataKey="p75" stackId="band2" stroke="none" fill="hsl(142, 71%, 45%)" fillOpacity={0.18} name="P75" />
          <Area type="monotone" dataKey="p50" stackId="band3" stroke="hsl(200, 98%, 39%)" fill="hsl(200, 98%, 39%)" fillOpacity={0.25} strokeWidth={2} name="P50" />
          <Area type="monotone" dataKey="p25" stackId="band4" stroke="none" fill="hsl(25, 95%, 53%)" fillOpacity={0.18} name="P25" />
          <Area type="monotone" dataKey="p10" stackId="band5" stroke="none" fill="hsl(0, 72%, 51%)" fillOpacity={0.12} name="P10" />
        </AreaChart>
      </ResponsiveContainer>
      <p className={cn("text-xs text-center leading-relaxed", colors.text.muted)}>
        {t('costCalculator.monteCarlo.fanChartLegend')}
      </p>
    </section>
  );
}

// =============================================================================
// HISTOGRAM + CDF
// =============================================================================

/** Histogram of NPV distribution with CDF overlay line */
export function HistogramChart({
  mcResult,
  t,
}: {
  mcResult: MonteCarloResult;
  t: MonteCarloTabProps['t'];
}) {
  const colors = useSemanticColors();
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  if (mcResult.histogram.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.histogramTitle')}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={mcResult.histogram} margin={{ top: 5, right: 50, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="midpoint"
            tickFormatter={(v: number) => fmt(v)}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            yAxisId="freq"
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: t('costCalculator.monteCarlo.frequency'), angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="cdf"
            orientation="right"
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: t('costCalculator.monteCarlo.cdf'), angle: 90, position: 'insideRight' }}
          />
          <Tooltip
            content={
              <FinancialTooltip
                labelFormatter={(label) => fmt(label as number)}
                valueFormatter={(value, name) => [
                  `${((value as number) * 100).toFixed(1)}%`,
                  name === 'frequency'
                    ? t('costCalculator.monteCarlo.frequency')
                    : t('costCalculator.monteCarlo.cdf'),
                ]}
              />
            }
          />
          <Bar yAxisId="freq" dataKey="frequency" fill="hsl(200, 98%, 39%)" opacity={0.7} name="frequency" />
          <Line yAxisId="cdf" type="monotone" dataKey="cumulativeFrequency" stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={false} name="cdf" />
        </ComposedChart>
      </ResponsiveContainer>
      <p className={cn("text-xs text-center leading-relaxed", colors.text.muted)}>
        {t('costCalculator.monteCarlo.histogramLegend')}
      </p>
    </section>
  );
}
