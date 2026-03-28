'use client';

/**
 * @module reports/sections/crm/LeadSourceChart
 * @enterprise ADR-265 Phase 8 — Leads by source pie chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { SourceItem } from './types';

interface LeadSourceChartProps {
  data: SourceItem[];
  loading?: boolean;
}

export function LeadSourceChart({ data, loading }: LeadSourceChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {};
  for (const item of data) {
    chartConfig[item.name] = {
      label: item.name,
      color: `hsl(var(--report-chart-${(Object.keys(chartConfig).length % 8) + 1}))`,
    };
  }

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('crm.leads.title')} id="lead-source">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('crm.leads.title')}
      description={t('crm.leads.description')}
      id="lead-source"
    >
      <ReportChart type="pie" data={data} config={chartConfig} height={300} />
    </ReportSection>
  );
}
