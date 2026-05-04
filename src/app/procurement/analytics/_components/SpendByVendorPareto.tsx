'use client';

/**
 * SpendByVendorPareto — Top 10 vendors Pareto chart (Bar + cumulative %).
 *
 * Vendors sorted desc by total spend; right-axis line shows cumulative
 * percentage of total. Bar click → drill-down to PO list filtered by
 * `supplierId` + current date range + active filter forwarding.
 *
 * @see ADR-331 §2.5, §4 D4, D5, D22, D23
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
  SpendAnalyticsFilters,
  VendorPoint,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import {
  buildPurchaseOrdersUrl,
  CHART_FIGURE_CLASSES,
  formatEurShort,
  readClickedRowKey,
  truncateLabel,
} from './chart-utils';
import { ChartTooltip } from './chart-tooltip';

interface SpendByVendorParetoProps {
  data: readonly VendorPoint[];
  filters: SpendAnalyticsFilters;
  isLoading: boolean;
  className?: string;
}

interface ParetoRow {
  supplierId: string;
  label: string;
  total: number;
  cumulativePct: number;
}

function buildParetoRows(points: readonly VendorPoint[]): ParetoRow[] {
  const sum = points.reduce((acc, p) => acc + (p.total ?? 0), 0);
  if (sum <= 0) {
    return points.map((p) => ({
      supplierId: p.supplierId,
      label: truncateLabel(p.supplierName, 20),
      total: p.total,
      cumulativePct: 0,
    }));
  }
  let running = 0;
  return points.map((p) => {
    running += p.total ?? 0;
    return {
      supplierId: p.supplierId,
      label: truncateLabel(p.supplierName, 20),
      total: p.total,
      cumulativePct: Math.round((running / sum) * 1000) / 10,
    };
  });
}

export function SpendByVendorPareto({
  data,
  filters,
  isLoading,
  className,
}: SpendByVendorParetoProps) {
  const { t } = useTranslation('procurement');
  const router = useRouter();

  const rows = useMemo<ParetoRow[]>(() => buildParetoRows(data), [data]);

  if (isLoading) return <KpiChartSkeleton />;

  const cumulativeName = t('analytics.charts.byVendor.cumulative');
  const totalName = t('analytics.charts.byVendor.title');

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {totalName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('analytics.charts.byVendor.empty')}
          </p>
        ) : (
          <figure aria-label={t('analytics.charts.byVendor.ariaLabel')} className={CHART_FIGURE_CLASSES}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={56}
                />
                <YAxis
                  yAxisId="amount"
                  tickFormatter={formatEurShort}
                  tick={{ fontSize: 11 }}
                  width={56}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  domain={[0, 100]}
                  width={42}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(value, key) =>
                        key === 'cumulativePct'
                          ? `${value.toFixed(1)}%`
                          : formatCurrency(value, 'EUR')
                      }
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="amount"
                  dataKey="total"
                  name={totalName}
                  fill="hsl(var(--chart-1))"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={36}
                  cursor="pointer"
                  onClick={(payload) => {
                    const supplierId = readClickedRowKey(payload, 'supplierId');
                    if (!supplierId) return;
                    router.push(
                      buildPurchaseOrdersUrl(filters, { supplierId: [supplierId] }),
                      { scroll: false },
                    );
                  }}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="cumulativePct"
                  name={cumulativeName}
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </figure>
        )}
      </CardContent>
    </Card>
  );
}
