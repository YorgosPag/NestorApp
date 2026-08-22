'use client';

/**
 * SpendByCategoryChart — οι 10 κορυφαίες κατηγορίες ΑΤΟΕ σε **οριζόντιες**
 * μπάρες. Κλικ σε μπάρα → λίστα εντολών αγοράς με `categoryCode`.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: πλαίσιο κάρτας, κενή κατάσταση και
 * `ResponsiveContainer` ζουν στο `<ChartCard>`. Το ύψος ήταν **δυναμικό**
 * (`max(220, γραμμές × 32 + 40)`) και γίνεται το ονομασμένο βήμα `lg`: με 10
 * γραμμές — το ανώτατο που παράγει ο aggregator — η διαφορά είναι 288px έναντι
 * 360px. Το ADR-710 απαιτεί **βήματα, όχι ελεύθερους αριθμούς**, ώστε οι κάρτες
 * να ευθυγραμμίζονται μεταξύ τους στο πλέγμα.
 *
 * 🔴 **ADR-742 §7quaterdecies**: η σύνθεση recharts έφυγε στο `<SpendTopBarChart>`
 * — ήταν η ίδια με του `SpendByProjectChart` με τον προσανατολισμό γυρισμένο.
 * Ό,τι μένει εδώ είναι το **μόνο** που ήταν πράγματι δικό της: πώς γίνονται οι
 * κωδικοί ΑΤΟΕ αναγνώσιμες ετικέτες, και πού οδηγεί το κλικ.
 *
 * @see ADR-331 §2.5, §4 D4, D5, D22, D23 · ADR-710 · ADR-742 §7quaterdecies
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SpendTopBarChart } from './SpendTopBarChart';
import { truncateLabel } from './chart-utils';
import type {
  CategoryPoint,
  SpendAnalyticsFilters,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';

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

  const rows = useMemo<CategoryRow[]>(
    () =>
      data.map((point) => ({
        code: point.code,
        label: truncateLabel(t(`categories.${point.code}`, { defaultValue: point.code }), 24),
        total: point.total,
      })),
    [data, t],
  );

  return (
    <SpendTopBarChart
      className={className}
      isLoading={isLoading}
      rows={rows}
      categoryKey="label"
      valueKey="total"
      orientation="bars"
      size="lg"
      title={t('analytics.charts.byCategory.title')}
      emptyMessage={t('analytics.charts.byCategory.empty')}
      categoryLabel={t('analytics.charts.byCategory.categoryLabel')}
      drillDown={{ filters, rowKey: 'code', filterKey: 'categoryCode' }}
    />
  );
}
