'use client';

/**
 * @module reports/sections/contacts/GeographicDistributionChart
 * @enterprise ADR-265 — Contacts by city
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';
import type { CityDistributionItem } from './types';

interface GeographicDistributionChartProps {
  data: CityDistributionItem[];
  loading?: boolean;
}

export function GeographicDistributionChart({
  data,
  loading,
}: GeographicDistributionChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<CityDistributionItem>[]>(
    () => [{ key: 'count', label: t('contacts.geographic.count') }],
    [t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('contacts.geographic.title')} id="geographic">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('contacts.geographic.title')}
      description={t('contacts.geographic.description')}
      id="geographic"
    >
      <ReportChart
        type="bar"
        data={data}
        series={series}
        categoryKey="city"
        categoryLabel={t('chart.category.city')}
        formatValue={formatNumber}
      />
    </ReportSection>
  );
}
