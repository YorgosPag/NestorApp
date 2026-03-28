'use client';

/**
 * @module reports/sections/spaces/ParkingZoneChart
 * @enterprise ADR-265 Phase 10 — Parking by location zone pie chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface ParkingZoneChartProps {
  data: { name: string; value: number }[];
  loading?: boolean;
}

export function ParkingZoneChart({ data, loading }: ParkingZoneChartProps) {
  const { t } = useTranslation('reports');

  const config: ChartConfig = {
    pilotis: { label: t('spaces.parking.zones.pilotis'), color: 'hsl(var(--report-chart-1))' },
    underground: { label: t('spaces.parking.zones.underground'), color: 'hsl(var(--report-chart-2))' },
    open_space: { label: t('spaces.parking.zones.open_space'), color: 'hsl(var(--report-chart-3))' },
    rooftop: { label: t('spaces.parking.zones.rooftop'), color: 'hsl(var(--report-chart-4))' },
    covered_outdoor: { label: t('spaces.parking.zones.covered_outdoor'), color: 'hsl(var(--report-chart-5))' },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('spaces.parking.zoneTitle')} id="parking-zone">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('spaces.parking.zoneTitle')}
      description={t('spaces.parking.zoneDescription')}
      id="parking-zone"
    >
      <ReportChart type="pie" data={data} config={config} height={280} />
    </ReportSection>
  );
}
