'use client';

/**
 * @module reports/sections/contacts/PersonaDistributionChart
 * @enterprise ADR-265 Phase 9 — Contacts by persona type bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface PersonaDistributionChartProps {
  data: { persona: string; count: number }[];
  loading?: boolean;
}

export function PersonaDistributionChart({ data, loading }: PersonaDistributionChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    count: {
      label: t('contacts.persona.count'),
      color: 'hsl(var(--report-chart-4))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('contacts.persona.title')} id="persona-distribution">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('contacts.persona.title')}
      description={t('contacts.persona.description')}
      id="persona-distribution"
    >
      <ReportChart
        type="bar"
        data={data}
        config={chartConfig}
        xAxisKey="persona"
        height={300}
      />
    </ReportSection>
  );
}
