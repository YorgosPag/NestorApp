'use client';

/**
 * @module reports/sections/spaces/StorageUtilizationChart
 * @enterprise ADR-265 Phase 10 — Storage by status & type pie charts
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface StorageUtilizationChartProps {
  statusData: { name: string; value: number }[];
  typeData: { name: string; value: number }[];
  loading?: boolean;
}

export function StorageUtilizationChart({ statusData, typeData, loading }: StorageUtilizationChartProps) {
  const { t } = useTranslation('reports');

  const statusConfig: ChartConfig = {
    available: { label: t('spaces.storage.statuses.available'), color: 'hsl(var(--report-chart-3))' },
    occupied: { label: t('spaces.storage.statuses.occupied'), color: 'hsl(var(--report-chart-1))' },
    maintenance: { label: t('spaces.storage.statuses.maintenance'), color: 'hsl(var(--report-chart-6))' },
    reserved: { label: t('spaces.storage.statuses.reserved'), color: 'hsl(var(--report-chart-4))' },
    sold: { label: t('spaces.storage.statuses.sold'), color: 'hsl(var(--report-chart-2))' },
    unavailable: { label: t('spaces.storage.statuses.unavailable'), color: 'hsl(var(--report-chart-5))' },
  };

  const typeConfig: ChartConfig = {
    large: { label: t('spaces.storage.types.large'), color: 'hsl(var(--report-chart-1))' },
    small: { label: t('spaces.storage.types.small'), color: 'hsl(var(--report-chart-2))' },
    basement: { label: t('spaces.storage.types.basement'), color: 'hsl(var(--report-chart-3))' },
    ground: { label: t('spaces.storage.types.ground'), color: 'hsl(var(--report-chart-4))' },
    special: { label: t('spaces.storage.types.special'), color: 'hsl(var(--report-chart-5))' },
    storage: { label: t('spaces.storage.types.storage'), color: 'hsl(var(--report-chart-6))' },
    garage: { label: t('spaces.storage.types.garage'), color: 'hsl(var(--report-chart-7))' },
    warehouse: { label: t('spaces.storage.types.warehouse'), color: 'hsl(var(--report-chart-8))' },
  };

  const hasData = statusData.length > 0 || typeData.length > 0;

  if (!loading && !hasData) {
    return (
      <ReportSection title={t('spaces.storage.title')} id="storage-utilization">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('spaces.storage.title')}
      description={t('spaces.storage.description')}
      id="storage-utilization"
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
