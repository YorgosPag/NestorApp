'use client';

/**
 * @module reports/sections/compliance/InsuranceClassChart
 * @enterprise ADR-265 Phase 12 — Workers by ΕΦΚΑ insurance class
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface InsuranceClassChartProps {
  data: { name: string; value: number }[];
  loading?: boolean;
}

export function InsuranceClassChart({ data, loading }: InsuranceClassChartProps) {
  const { t } = useTranslation('reports');

  // Dynamic config — insurance classes are numeric, generate colors
  const config: ChartConfig = Object.fromEntries(
    data.map((item, i) => [
      item.name,
      {
        label: `${t('compliance.insurance.classLabel')} ${item.name}`,
        color: `hsl(var(--report-chart-${(i % 8) + 1}))`,
      },
    ]),
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('compliance.insurance.title')} id="insurance-class">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('compliance.insurance.title')}
      description={t('compliance.insurance.description')}
      id="insurance-class"
    >
      <ReportChart type="bar" data={data} config={config} height={300} />
    </ReportSection>
  );
}
