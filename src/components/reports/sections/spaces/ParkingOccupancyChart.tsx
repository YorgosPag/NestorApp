'use client';

/**
 * @module reports/sections/spaces/ParkingOccupancyChart
 * @enterprise ADR-265 Phase 10 — Parking by status & type pie charts
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface ParkingOccupancyChartProps {
  statusData: { name: string; value: number }[];
  typeData: { name: string; value: number }[];
  loading?: boolean;
}

export function ParkingOccupancyChart({ statusData, typeData, loading }: ParkingOccupancyChartProps) {
  const { t } = useTranslation('reports');

  const statusConfig: ChartConfig = {
    available: { label: t('spaces.parking.statuses.available'), color: 'hsl(var(--report-chart-3))' },
    occupied: { label: t('spaces.parking.statuses.occupied'), color: 'hsl(var(--report-chart-1))' },
    reserved: { label: t('spaces.parking.statuses.reserved'), color: 'hsl(var(--report-chart-4))' },
    sold: { label: t('spaces.parking.statuses.sold'), color: 'hsl(var(--report-chart-2))' },
    maintenance: { label: t('spaces.parking.statuses.maintenance'), color: 'hsl(var(--report-chart-6))' },
  };

  const typeConfig: ChartConfig = {
    standard: { label: t('spaces.parking.types.standard'), color: 'hsl(var(--report-chart-1))' },
    handicapped: { label: t('spaces.parking.types.handicapped'), color: 'hsl(var(--report-chart-2))' },
    motorcycle: { label: t('spaces.parking.types.motorcycle'), color: 'hsl(var(--report-chart-3))' },
    electric: { label: t('spaces.parking.types.electric'), color: 'hsl(var(--report-chart-4))' },
    visitor: { label: t('spaces.parking.types.visitor'), color: 'hsl(var(--report-chart-5))' },
  };

  const hasData = statusData.length > 0 || typeData.length > 0;

  if (!loading && !hasData) {
    return (
      <ReportSection title={t('spaces.parking.title')} id="parking-occupancy">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('spaces.parking.title')}
      description={t('spaces.parking.description')}
      id="parking-occupancy"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {statusData.length > 0 && (
          <ReportChart type="pie" data={statusData} config={statusConfig} height={280} />
        )}
        {typeData.length > 0 && (
          <ReportChart type="pie" data={typeData} config={typeConfig} height={280} />
        )}
      </div>
    </ReportSection>
  );
}
