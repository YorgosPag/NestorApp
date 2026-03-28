'use client';

/**
 * @module reports/sections/projects/EnergyClassDistribution
 * @enterprise ADR-265 Phase 7 — Units by energy class pie chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { EnergyClassItem } from './types';

interface EnergyClassDistributionProps {
  data: EnergyClassItem[];
  loading?: boolean;
}

// Energy class colors follow EU EPC standard: green (A+) → red (G)
// eslint-disable-next-line custom/no-hardcoded-strings -- HSL color values, not translatable text
const CLASS_COLORS: Record<string, string> = {
  'A+': 'hsl(var(--report-chart-3))',
  'A': 'hsl(var(--report-chart-3))',
  'B': 'hsl(var(--report-chart-2))',
  'C': 'hsl(var(--report-chart-4))',
  'D': 'hsl(var(--report-chart-8))',
  'E': 'hsl(var(--report-chart-6))',
  'F': 'hsl(var(--report-chart-5))',
  'G': 'hsl(var(--report-chart-7))',
};

export function EnergyClassDistribution({ data, loading }: EnergyClassDistributionProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {};
  for (const item of data) {
    chartConfig[item.name] = {
      label: item.name,
      color: CLASS_COLORS[item.name] ?? 'hsl(var(--report-chart-6))',
    };
  }

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.energyClass.title')} id="energy-class">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.energyClass.title')}
      description={t('projects.energyClass.description')}
      id="energy-class"
    >
      <ReportChart type="pie" data={data} config={chartConfig} height={300} />
    </ReportSection>
  );
}
