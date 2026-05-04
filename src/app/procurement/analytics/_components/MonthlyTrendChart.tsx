'use client';

/**
 * MonthlyTrendChart — Current-period monthly spend LineChart.
 *
 * Aggregator (Phase B1) emits monthlyTrend only for the *current* period;
 * the previous-period series is deferred to a follow-up phase. Until then
 * the chart shows a single line plus the i18n note `previousPending`.
 *
 * @see ADR-331 §2.5, §4 D4, D8, D22, D23
 */

import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { KpiChartSkeleton } from '@/components/projects/procurement/overview/skeleton/KpiSkeleton';
import type { MonthlyPoint } from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import { CHART_FIGURE_CLASSES, formatEurShort } from './chart-utils';
import { ChartTooltip } from './chart-tooltip';

interface MonthlyTrendChartProps {
  data: readonly MonthlyPoint[];
  isLoading: boolean;
  className?: string;
}

interface MonthRow {
  month: string;
  label: string;
  current: number;
}

const MONTH_PARTS_REGEX = /^(\d{4})-(\d{2})$/;

function formatMonthLabel(month: string, locale: string): string {
  const match = MONTH_PARTS_REGEX.exec(month);
  if (!match) return month;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (Number.isNaN(year) || monthIndex < 0 || monthIndex > 11) return month;
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(date);
}

export function MonthlyTrendChart({ data, isLoading, className }: MonthlyTrendChartProps) {
  const { t, i18n } = useTranslation('procurement');

  const rows = useMemo<MonthRow[]>(
    () =>
      data.map((point) => ({
        month: point.month,
        label: formatMonthLabel(point.month, i18n.language),
        current: point.total,
      })),
    [data, i18n.language],
  );

  if (isLoading) return <KpiChartSkeleton />;

  const currentName = t('analytics.charts.monthlyTrend.currentLabel');

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('analytics.charts.monthlyTrend.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('analytics.charts.monthlyTrend.empty')}
          </p>
        ) : (
          <figure aria-label={t('analytics.charts.monthlyTrend.ariaLabel')} className={CHART_FIGURE_CLASSES}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatEurShort} tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  content={<ChartTooltip formatter={(value) => formatCurrency(value, 'EUR')} />}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="current"
                  name={currentName}
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <figcaption className="mt-2 text-xs text-muted-foreground">
              {t('analytics.charts.monthlyTrend.previousPending')}
            </figcaption>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
