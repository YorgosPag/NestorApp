'use client';

/**
 * FinancialQueryChart — the plot an answer from the financial query assistant carries.
 *
 * Renders through the ADR-710 chart card shell.
 *
 * ## The one place a chart type is legitimately a value
 *
 * ADR-710 rejects a `type` prop on the shell, because a shell that switches on chart
 * type grows a branch per type forever. That is not the case here: the assistant
 * *returns* `'bar' | 'line'` as part of its answer, so the choice is data, and it is
 * made once at this call-site by picking which recharts composition to hand the shell.
 * The shell still knows nothing about it.
 *
 * @enterprise ADR-242 SPEC-242E
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

import {
  CHART_BAR_RADIUS,
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';

// =============================================================================
// TYPES
// =============================================================================

export interface QueryChartPoint {
  label: string;
  value: number;
}

export type QueryChartType = 'bar' | 'line';

interface FinancialQueryChartProps {
  readonly data: readonly QueryChartPoint[];
  readonly type: QueryChartType;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FinancialQueryChart({ data, type }: FinancialQueryChartProps) {
  const { t } = useTranslation(['payments']);

  const series = useMemo<ChartSeries<QueryChartPoint>[]>(
    () => [{ key: 'value', label: t('financialQuery.chartValue') }],
    [t],
  );

  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value) ?? '', []);

  /**
   * Grid, axes and hover layer — the same for both compositions, so they are stated
   * once. It has to be an array and not a component: recharts locates its children by
   * `displayName` and only unwraps fragments, so anything wrapped in a component of
   * ours is never found — the chart renders and the axes silently do not (ADR-710 §6.1).
   * `React.Children` flattens a nested array, so these arrive as direct children.
   */
  const frame = [
    <CartesianGrid key="grid" strokeDasharray="3 3" opacity={0.3} />,
    <XAxis key="category" dataKey="label" tickLine={false} axisLine={false} />,
    <YAxis
      key="value"
      tickFormatter={formatCurrencyCompact}
      width={72}
      tickLine={false}
      axisLine={false}
    />,
    <ChartCard.Tooltip key="tooltip" />,
  ];

  return (
    <ChartCard
      series={series}
      data={data}
      categoryKey="label"
      categoryLabel={t('financialQuery.chartCategory')}
      formatValue={formatEuro}
    >
      <ChartCard.Header title={t('financialQuery.chartTitle')} />
      <ChartCard.Figure
        caption={t('financialQuery.chartCaption')}
        emptyMessage={t('financialQuery.chartEmptyState')}
      >
        {type === 'line' ? (
          <LineChart data={data}>
            {frame}
            <Line
              type="monotone"
              dataKey="value"
              stroke={seriesColorVar('value')}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        ) : (
          <BarChart data={data}>
            {frame}
            <Bar dataKey="value" fill={seriesColorVar('value')} radius={CHART_BAR_RADIUS} />
          </BarChart>
        )}
      </ChartCard.Figure>
    </ChartCard>
  );
}
