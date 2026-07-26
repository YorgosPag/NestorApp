'use client';

/**
 * Counterproposal savings chart — saving, discount and net gain per scenario.
 *
 * Renders through the ADR-710 chart card shell. The three `--chart-N` variables this
 * chart used to name directly are now positional: the series list is the only place
 * the order is fixed, and the legend and data table are derived from the same list.
 *
 * @enterprise ADR-234 SPEC-234F — Counterproposal Tab
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

import {
  CHART_BAR_RADIUS,
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

export interface CounterproposalScenarioPoint {
  name: string;
  saving: number;
  discount: number;
  gain: number;
}

interface CounterproposalChartProps {
  readonly data: readonly CounterproposalScenarioPoint[];
  readonly t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CounterproposalChart({ data, t }: CounterproposalChartProps) {
  const series = useMemo<ChartSeries<CounterproposalScenarioPoint>[]>(
    () => [
      { key: 'saving', label: t('costCalculator.counterproposal.chart.saving') },
      { key: 'discount', label: t('costCalculator.counterproposal.chart.discount') },
      { key: 'gain', label: t('costCalculator.counterproposal.chart.gain') },
    ],
    [t],
  );

  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value), []);

  return (
    <ChartCard
      series={series}
      data={data}
      categoryKey="name"
      categoryLabel={t('costCalculator.counterproposal.table.scenario')}
      categoryDescription={t('costCalculator.counterproposal.table.scenarioTooltip')}
      formatValue={formatEuro}
    >
      <ChartCard.Header title={t('costCalculator.counterproposal.chart.title')} />
      <ChartCard.Figure
        caption={t('costCalculator.counterproposal.chart.caption')}
        emptyMessage={t('costCalculator.counterproposal.chart.emptyState')}
      >
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={formatCurrencyCompact}
            width={72}
            tickLine={false}
            axisLine={false}
          />
          <ChartCard.Tooltip />
          <Bar dataKey="saving" fill={seriesColorVar('saving')} radius={CHART_BAR_RADIUS} />
          <Bar dataKey="discount" fill={seriesColorVar('discount')} radius={CHART_BAR_RADIUS} />
          <Bar dataKey="gain" fill={seriesColorVar('gain')} radius={CHART_BAR_RADIUS} />
        </BarChart>
      </ChartCard.Figure>
    </ChartCard>
  );
}
