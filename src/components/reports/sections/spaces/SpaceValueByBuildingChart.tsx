'use client';

/**
 * @module reports/sections/spaces/SpaceValueByBuildingChart
 * @enterprise ADR-265 — Parking and storage value per building
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { BuildingValueItem } from './types';

interface SpaceValueByBuildingChartProps {
  data: BuildingValueItem[];
  loading?: boolean;
}

export function SpaceValueByBuildingChart({ data, loading }: SpaceValueByBuildingChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<BuildingValueItem>[]>(
    () => [
      { key: 'parkingValue', label: t('spaces.byBuilding.parkingValue') },
      { key: 'storageValue', label: t('spaces.byBuilding.storageValue') },
    ],
    [t],
  );

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
        series={series}
        categoryKey="building"
        categoryLabel={t('chart.category.building')}
        formatValue={formatCurrencyWhole}
      />
    </ReportSection>
  );
}
