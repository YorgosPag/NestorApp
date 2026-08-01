'use client';

/**
 * MonthlyTrendChart — Current-period monthly spend LineChart.
 *
 * Aggregator (Phase B1) emits monthlyTrend only for the *current* period;
 * the previous-period series is deferred to a follow-up phase. Until then
 * the chart shows a single line plus the i18n note `previousPending`.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: πλαίσιο κάρτας, κενή κατάσταση και
 * `ResponsiveContainer` ζουν στο `<ChartCard>`· ελεύθερο ύψος 260px → βήμα `md`.
 *
 * 🔑 Το `<Legend>` **αφαιρέθηκε χωρίς αντικατάσταση**: το shell το αποφασίζει από
 * την περιγραφή — υπόμνημα για ≥2 σειρές, **ποτέ** για μία. Εδώ η σειρά είναι
 * **μία** και την ονομάζει ήδη ο τίτλος της κάρτας, οπότε το κουτί ήταν θόρυβος.
 * Όταν προστεθεί η σειρά προηγούμενης περιόδου, το υπόμνημα θα εμφανιστεί
 * **μόνο του** — δεν χρειάζεται κανείς να το θυμηθεί.
 *
 * @see ADR-331 §2.5, §4 D4, D8, D22, D23 · ADR-710 (chart-card shell)
 */

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartCardTooltip,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { SpendAnalyticsChart } from './SpendAnalyticsChart';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { MonthlyPoint } from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import {
  CHART_MARGIN,
  EUR_VALUE_AXIS,
  formatEur,
} from './chart-utils';

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

  const series = useMemo<readonly ChartSeries<MonthRow>[]>(
    () => [{ key: 'current', label: t('analytics.charts.monthlyTrend.currentLabel') }],
    [t],
  );


  return (
    <SpendAnalyticsChart
      className={className}
      isLoading={isLoading}
      series={series}
      data={rows}
      categoryKey="label"
      categoryLabel={t('analytics.charts.monthlyTrend.categoryLabel')}
      formatValue={formatEur}
      title={t('analytics.charts.monthlyTrend.title')}
      caption={t('analytics.charts.monthlyTrend.previousPending')}
      emptyMessage={t('analytics.charts.monthlyTrend.empty')}
    >
          <LineChart data={rows} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis {...EUR_VALUE_AXIS} />
            <ChartCardTooltip />
            <Line
              type="monotone"
              dataKey="current"
              stroke={seriesColorVar('current')}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
    </SpendAnalyticsChart>
  );
}
