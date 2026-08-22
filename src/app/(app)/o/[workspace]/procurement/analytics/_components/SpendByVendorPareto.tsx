'use client';

/**
 * SpendByVendorPareto — Top 10 vendors Pareto chart (Bar + cumulative %).
 *
 * Vendors sorted desc by total spend; right-axis line shows cumulative
 * percentage of total. Bar click → drill-down to PO list filtered by
 * `supplierId` + current date range + active filter forwarding.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: πλαίσιο κάρτας, υπόμνημα, κενή
 * κατάσταση και `ResponsiveContainer` ζουν στο `<ChartCard>`· ελεύθερο ύψος
 * 280px → βήμα `md`. Το `<Legend>` **δεν** δηλώνεται πια: το shell το βγάζει
 * επειδή οι σειρές είναι **δύο**, όχι επειδή το ζήτησε ο καλών.
 *
 * 🔴 **Δύο μονάδες σε μία κάρτα.** Το Pareto σχεδιάζει ευρώ αριστερά και
 * **ποσοστό** δεξιά. Ο μορφοποιητής της κάρτας είναι ένας, οπότε η σειρά
 * `cumulativePct` φέρνει **τον δικό της** (`ChartSeries.formatValue`,
 * ADR-742 §7quaterdecies). Χωρίς αυτό, ο προσβάσιμος πίνακας δεδομένων — που
 * το shell παράγει υποχρεωτικά — θα τύπωνε το `84,3%` ως `84,30 €`.
 *
 * @see ADR-331 §2.5, §4 D4, D5, D22, D23 · ADR-710 (chart-card shell)
 */

import { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import {
  ChartCardTooltip,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { SpendAnalyticsChart } from './SpendAnalyticsChart';
import { useDrillDownToPurchaseOrders } from './useDrillDownToPurchaseOrders';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  SpendAnalyticsFilters,
  VendorPoint,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import {
  CHART_MARGIN,
  EUR_VALUE_AXIS,
  ROTATED_CATEGORY_AXIS,
  formatEur,
  truncateLabel,
} from './chart-utils';

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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
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
  const handleBarClick = useDrillDownToPurchaseOrders({
    filters,
    rowKey: 'supplierId',
    filterKey: 'supplierId',
  });

  const rows = useMemo<ParetoRow[]>(() => buildParetoRows(data), [data]);

  const series = useMemo<readonly ChartSeries<ParetoRow>[]>(
    () => [
      { key: 'total', label: t('analytics.charts.byVendor.title') },
      {
        key: 'cumulativePct',
        label: t('analytics.charts.byVendor.cumulative'),
        formatValue: formatPercent,
      },
    ],
    [t],
  );


  return (
    <SpendAnalyticsChart
      className={className}
      isLoading={isLoading}
      series={series}
      data={rows}
      categoryKey="label"
      categoryLabel={t('analytics.charts.byVendor.categoryLabel')}
      formatValue={formatEur}
      title={t('analytics.charts.byVendor.title')}
      emptyMessage={t('analytics.charts.byVendor.empty')}
    >
          <ComposedChart data={rows} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              {...ROTATED_CATEGORY_AXIS}
            />
            <YAxis yAxisId="amount" {...EUR_VALUE_AXIS} />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11 }}
              domain={[0, 100]}
              width={42}
            />
            <ChartCardTooltip />
            <Bar
              yAxisId="amount"
              dataKey="total"
              fill={seriesColorVar('total')}
              radius={[3, 3, 0, 0]}
              maxBarSize={36}
              cursor="pointer"
              onClick={handleBarClick}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="cumulativePct"
              stroke={seriesColorVar('cumulativePct')}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
    </SpendAnalyticsChart>
  );
}
