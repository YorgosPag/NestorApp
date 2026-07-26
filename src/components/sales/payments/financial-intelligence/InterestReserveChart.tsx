'use client';

/**
 * InterestReserveChart — the interest reserve balance draining month by month.
 *
 * Renders through the ADR-710 chart card shell. The literal hues this file carried
 * behind two eslint suppressions are gone: the depletion gradient and the exhaustion
 * markers now read `CHART_STATUS_RAMP`, so the plot follows the theme instead of
 * drawing the light ramp in dark mode.
 *
 * @enterprise ADR-242 SPEC-242B — Draw Schedule
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useId, useMemo } from 'react';
import { AreaChart, Area, ReferenceLine } from 'recharts';
import { AlertTriangle } from 'lucide-react';

import {
  CHART_STATUS_RAMP,
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { financialAxisFrame } from './financial-chart-axes';
import type { DrawPeriodAnalysis, InterestReserveStatus } from '@/types/interest-calculator';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface InterestReserveChartProps {
  periods: DrawPeriodAnalysis[];
  reserveStatus: InterestReserveStatus;
  t: (key: string, opts?: Record<string, string>) => string;
}

interface ReservePoint {
  month: string;
  reserveBalance: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InterestReserveChart({ periods, reserveStatus, t }: InterestReserveChartProps) {
  // Scoped so two cards on one screen cannot share a gradient definition.
  const gradientId = `reserve-depletion-${useId().replace(/:/g, '')}`;

  const chartData = useMemo<ReservePoint[]>(
    () =>
      periods.map((period) => ({
        month: `M${period.month + 1}`,
        reserveBalance: Math.round(period.reserveBalance),
      })),
    [periods],
  );

  const series = useMemo<ChartSeries<ReservePoint>[]>(
    () => [
      {
        key: 'reserveBalance',
        label: t('costCalculator.drawSchedule.reserveBalance'),
        // The reserve is one measure draining toward zero, not one of several
        // categories, so it takes the healthy end of the status ramp rather than a
        // position in the categorical palette.
        color: CHART_STATUS_RAMP.healthy,
      },
    ],
    [t],
  );

  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value), []);

  return (
    <ChartCard
      series={series}
      data={chartData}
      categoryKey="month"
      categoryLabel={t('costCalculator.drawSchedule.month')}
      formatValue={formatEuro}
    >
      <ChartCard.Header title={t('costCalculator.drawSchedule.reserveTitle')} />

      <ChartCard.Figure
        caption={t('costCalculator.drawSchedule.reserveCaption')}
        emptyMessage={t('costCalculator.drawSchedule.reserveEmptyState')}
      >
        <AreaChart data={chartData}>
          <defs>
            {/* Healthy at the top of the band, exhausted at the baseline — the fill
                itself says how far the drain has gone. */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_STATUS_RAMP.healthy} stopOpacity={0.6} />
              <stop offset="50%" stopColor={CHART_STATUS_RAMP.caution} stopOpacity={0.4} />
              <stop offset="100%" stopColor={CHART_STATUS_RAMP.critical} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          {financialAxisFrame({ categoryKey: 'month' })}
          <ReferenceLine
            y={0}
            stroke={CHART_STATUS_RAMP.critical}
            strokeDasharray="5 3"
            strokeWidth={1.5}
          />
          {reserveStatus.exhaustionMonth !== null ? (
            <ReferenceLine
              x={`M${reserveStatus.exhaustionMonth + 1}`}
              stroke={CHART_STATUS_RAMP.critical}
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: t('costCalculator.drawSchedule.exhaustion'),
                position: 'top',
                fontSize: 10,
                fill: CHART_STATUS_RAMP.critical,
              }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="reserveBalance"
            stroke={seriesColorVar('reserveBalance')}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ChartCard.Figure>

      {!reserveStatus.sufficient ? (
        <aside className="mt-4 flex gap-2 rounded-lg border border-destructive bg-destructive/10 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-destructive">
            {t('costCalculator.drawSchedule.reserveWarning', {
              month: String((reserveStatus.exhaustionMonth ?? 0) + 1),
              shortfall: formatCurrencyWhole(reserveStatus.cashShortfall),
            })}
          </p>
        </aside>
      ) : null}
    </ChartCard>
  );
}
