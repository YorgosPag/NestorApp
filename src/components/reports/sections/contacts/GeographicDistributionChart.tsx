'use client';

/**
 * @module reports/sections/contacts/GeographicDistributionChart
 * @enterprise ADR-265 Phase 9 — Contacts by city bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { CityDistributionItem } from './types';

interface GeographicDistributionChartProps {
  data: CityDistributionItem[];
  loading?: boolean;
}

export function GeographicDistributionChart({ data, loading }: GeographicDistributionChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    count: {
      label: t('contacts.geographic.count'),
      color: 'hsl(var(--report-chart-5))',
    },
  };

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
        config={chartConfig}
        xAxisKey="city"
        height={300}
      />
    </ReportSection>
  );
}
