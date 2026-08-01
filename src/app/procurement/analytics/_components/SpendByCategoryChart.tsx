'use client';

/**
 * SpendByCategoryChart — Top 10 ATOE categories horizontal BarChart.
 *
 * Drill-down: clicking a bar navigates to `/procurement/purchase-orders`
 * with `categoryCode` + current date range + active filter forwarding.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: το πλαίσιο κάρτας, η κενή κατάσταση
 * και το `ResponsiveContainer` ζουν πλέον στο `<ChartCard>`. Το ύψος ήταν
 * **δυναμικό** (`max(220, γραμμές × 32 + 40)`) και γίνεται το ονομασμένο βήμα
 * `lg`: με 10 γραμμές — το ανώτατο που παράγει ο aggregator — η διαφορά είναι
 * 288px έναντι 360px. Το ADR-710 απαιτεί **βήματα, όχι ελεύθερους αριθμούς**,
 * ώστε οι κάρτες να ευθυγραμμίζονται μεταξύ τους στο πλέγμα.
 *
 * @see ADR-331 §2.5, §4 D4, D5, D22, D23 · ADR-710 (chart-card shell)
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartCard,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { KpiChartSkeleton } from '@/components/projects/procurement/overview/skeleton/KpiSkeleton';
import type {
  CategoryPoint,
  SpendAnalyticsFilters,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import {
  buildPurchaseOrdersUrl,
  formatEurShort,
  readClickedRowKey,
  truncateLabel,
} from './chart-utils';

interface SpendByCategoryChartProps {
  data: readonly CategoryPoint[];
  filters: SpendAnalyticsFilters;
  isLoading: boolean;
  className?: string;
}

interface CategoryRow {
  code: string;
  label: string;
  total: number;
}

export function SpendByCategoryChart({
  data,
  filters,
  isLoading,
  className,
}: SpendByCategoryChartProps) {
  const { t } = useTranslation('procurement');
  const router = useRouter();

  const rows = useMemo<CategoryRow[]>(
    () =>
      data.map((point) => ({
        code: point.code,
        label: truncateLabel(t(`categories.${point.code}`, { defaultValue: point.code }), 24),
        total: point.total,
      })),
    [data, t],
  );

  const series = useMemo<readonly ChartSeries<CategoryRow>[]>(
    () => [{ key: 'total', label: t('analytics.charts.byCategory.title') }],
    [t],
  );

  if (isLoading) return <KpiChartSkeleton />;

  return (
    <section className={className}>
      <ChartCard
        series={series}
        data={rows}
        categoryKey="label"
        categoryLabel={t('analytics.charts.byCategory.categoryLabel')}
        formatValue={(value) => formatCurrency(value, 'EUR')}
      >
        <ChartCard.Header title={t('analytics.charts.byCategory.title')} />
        <ChartCard.Figure
          emptyMessage={t('analytics.charts.byCategory.empty')}
          size="lg"
        >
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={formatEurShort} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} />
            <ChartCard.Tooltip />
            <Bar
              dataKey="total"
              fill={seriesColorVar('total')}
              radius={[0, 3, 3, 0]}
              cursor="pointer"
              onClick={(payload) => {
                const code = readClickedRowKey(payload, 'code');
                if (!code) return;
                router.push(
                  buildPurchaseOrdersUrl(filters, { categoryCode: [code] }),
                  { scroll: false },
                );
              }}
            />
          </BarChart>
        </ChartCard.Figure>
      </ChartCard>
    </section>
  );
}
