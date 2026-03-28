'use client';

/**
 * @module reports/sections/spaces/SpaceValueByBuildingChart
 * @enterprise ADR-265 Phase 10 — Parking + Storage value per building (grouped bar)
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { BuildingValueItem } from './types';

interface SpaceValueByBuildingChartProps {
  data: BuildingValueItem[];
  loading?: boolean;
}

export function SpaceValueByBuildingChart({ data, loading }: SpaceValueByBuildingChartProps) {
  const { t } = useTranslation('reports');

  const config: ChartConfig = {
    parkingValue: { label: t('spaces.byBuilding.parkingValue'), color: 'hsl(var(--report-chart-1))' },
    storageValue: { label: t('spaces.byBuilding.storageValue'), color: 'hsl(var(--report-chart-3))' },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('spaces.byBuilding.title')} id="space-value-building">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('spaces.byBuilding.title')}
      description={t('spaces.byBuilding.description')}
      id="space-value-building"
    >
      <ReportChart
        type="bar"
        data={data}
        config={config}
        height={320}
        xKey="building"
        bars={['parkingValue', 'storageValue']}
      />
    </ReportSection>
  );
}
