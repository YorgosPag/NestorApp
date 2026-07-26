'use client';

/**
 * DrawTimelineChart — draw amounts per month against the cumulative capital drawn.
 *
 * Renders through the ADR-710 chart card shell.
 *
 * ## Why the nine phase colors are gone
 *
 * Each bar used to be painted by construction phase from a private table of nine
 * literal hues, with a swatch list underneath as the only key. Nine is past what the
 * theme can encode — `globals.css` defines five categorical steps, and the measured
 * separation of those five is already marginal under deuteranopia (ADR-710 §4). So the
 * phase was identity carried by color alone, across more categories than the palette
 * has, in colors that ignored dark mode.
 *
 * The phase did not need a color. It names the month, so it goes into
 * `formatCategory` — which the tooltip heading and the data-table row header both read.
 * The information is now in two places instead of one, and both survive a theme change.
 *
 * @enterprise ADR-242 SPEC-242B — Draw Schedule
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useMemo } from 'react';
import { ComposedChart, Bar, Line } from 'recharts';

import {
  CHART_BAR_RADIUS,
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { financialAxisFrame } from './financial-chart-axes';
import type { DrawPeriodAnalysis } from '@/types/interest-calculator';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface DrawTimelineChartProps {
  periods: DrawPeriodAnalysis[];
  t: (key: string, opts?: Record<string, string>) => string;
}

interface DrawTimelinePoint {
  month: string;
  drawAmount: number;
  cumulativeDrawn: number;
}

// =============================================================================
// DERIVATIONS
// =============================================================================

function monthLabel(monthIndex: number): string {
  return `M${monthIndex + 1}`;
}

function buildChartData(periods: DrawPeriodAnalysis[]): DrawTimelinePoint[] {
  return periods.map((period) => ({
    month: monthLabel(period.month),
    drawAmount: period.drawEvent ? period.drawEvent.drawAmount : 0,
    cumulativeDrawn: period.cumulativeDrawn,
  }));
}

/** Months that carry a draw, by the name they are plotted under. */
function buildDrawLabels(periods: DrawPeriodAnalysis[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const period of periods) {
    if (period.drawEvent?.label) {
      labels.set(monthLabel(period.month), period.drawEvent.label);
    }
  }
  return labels;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DrawTimelineChart({ periods, t }: DrawTimelineChartProps) {
  const chartData = useMemo(() => buildChartData(periods), [periods]);
  const drawLabels = useMemo(() => buildDrawLabels(periods), [periods]);

  const series = useMemo<ChartSeries<DrawTimelinePoint>[]>(
    () => [
      { key: 'drawAmount', label: t('costCalculator.drawSchedule.drawAmount') },
      { key: 'cumulativeDrawn', label: t('costCalculator.drawSchedule.cumulativeDrawn') },
    ],
    [t],
  );

  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value), []);

  /** A month that funds a phase is named by it — read by tooltip and data table alike. */
  const formatMonth = useCallback(
    (value: unknown) => {
      const month = value == null ? '' : String(value);
      const label = drawLabels.get(month);
      return label ? `${month} · ${label}` : month;
    },
    [drawLabels],
  );

  return (
    <ChartCard
      series={series}
      data={chartData}
      categoryKey="month"
      categoryLabel={t('costCalculator.drawSchedule.month')}
      formatValue={formatEuro}
      formatCategory={formatMonth}
    >
      <ChartCard.Header title={t('costCalculator.drawSchedule.timelineTitle')} />

      <ChartCard.Figure
        caption={t('costCalculator.drawSchedule.timelineCaption')}
        emptyMessage={t('costCalculator.drawSchedule.timelineEmptyState')}
      >
        <ComposedChart data={chartData}>
          {financialAxisFrame({ categoryKey: 'month' })}
          <Bar dataKey="drawAmount" fill={seriesColorVar('drawAmount')} radius={CHART_BAR_RADIUS} />
          <Line
            type="stepAfter"
            dataKey="cumulativeDrawn"
            stroke={seriesColorVar('cumulativeDrawn')}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartCard.Figure>
    </ChartCard>
  );
}
