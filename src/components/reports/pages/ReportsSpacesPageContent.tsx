'use client';

/**
 * @module reports/spaces
 * @enterprise ADR-265 Phase 10 — Spaces (Parking/Storage) Report Dashboard
 * @lazy ADR-294 Batch 2 — Extracted for dynamic import
 *
 * KPIs, parking occupancy, parking zones, storage utilization, value per building.
 */

import { useTranslation } from 'react-i18next';
import { Archive } from 'lucide-react';
import { ReportPage } from '@/components/reports/core/ReportPage';
import { useSpacesReport } from '@/hooks/reports/useSpacesReport';
import {
  SpacesKPIs,
  ParkingOccupancyChart,
  ParkingZoneChart,
  StorageUtilizationChart,
  SpaceValueByBuildingChart,
} from '@/components/reports/sections/spaces';

export function ReportsSpacesPageContent() {
  const { t } = useTranslation('reports');
  const report = useSpacesReport();

  return (
    <ReportPage
      title={t('nav.spaces')}
      description={t('spaces.description')}
      icon={Archive}
      onRefresh={report.refetch}
    >
      <SpacesKPIs kpis={report.kpis} loading={report.loading} />

      <ParkingOccupancyChart
        statusData={report.parkingStatusPie}
        typeData={report.parkingTypePie}
        loading={report.loading}
      />

      <ParkingZoneChart data={report.parkingZonePie} loading={report.loading} />

      <StorageUtilizationChart
        statusData={report.storageStatusPie}
        typeData={report.storageTypePie}
        loading={report.loading}
      />

      <SpaceValueByBuildingChart data={report.buildingValues} loading={report.loading} />
    </ReportPage>
  );
}

export default ReportsSpacesPageContent;
