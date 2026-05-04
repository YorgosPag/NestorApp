'use client';

/**
 * SpendByCategoryChart — Top 10 ATOE categories horizontal BarChart.
 *
 * Drill-down: clicking a bar navigates to `/procurement/purchase-orders`
 * with `categoryCode` + current date range + active filter forwarding.
 *
 * @see ADR-331 §2.5, §4 D4, D5, D22, D23
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const ROW_HEIGHT_PX = 32;
const MIN_HEIGHT_PX = 220;

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

  if (isLoading) return <KpiChartSkeleton />;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t('analytics.charts.byCategory.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('analytics.charts.byCategory.empty')}
          </p>
        ) : (
          <figure aria-label={t('analytics.charts.byCategory.ariaLabel')} className="m-0">
            <ResponsiveContainer
              width="100%"
              height={Math.max(MIN_HEIGHT_PX, rows.length * ROW_HEIGHT_PX + 40)}
            >
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={formatEurShort} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  width={140}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, 'EUR')}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar
                  dataKey="total"
                  fill="hsl(var(--chart-1))"
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
            </ResponsiveContainer>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
