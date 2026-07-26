'use client';

/**
 * @module reports/sections/contacts/PersonaDistributionChart
 * @enterprise ADR-265 — Contacts by persona
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';

interface PersonaBar {
  persona: string;
  count: number;
}

interface PersonaDistributionChartProps {
  data: PersonaBar[];
  loading?: boolean;
}

export function PersonaDistributionChart({ data, loading }: PersonaDistributionChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<PersonaBar>[]>(
    () => [{ key: 'count', label: t('contacts.persona.count') }],
    [t],
  );

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
        series={series}
        categoryKey="persona"
        categoryLabel={t('chart.category.persona')}
        formatValue={formatNumber}
      />
    </ReportSection>
  );
}
