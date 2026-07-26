'use client';

/**
 * @module reports/sections/spaces/ParkingOccupancyChart
 * @enterprise ADR-265 — Parking spaces by status and by type
 * @enterprise ADR-710 §11.6
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  buildCategoryPie,
  ReportEmptyState,
  type ReportCategorySlice,
} from '@/components/reports/core';

/** Both vocabularies, as the locale groups under `spaces.parking` enumerate them. */
const PARKING_STATUSES = ['available', 'occupied', 'reserved', 'sold', 'maintenance'] as const;
const PARKING_TYPES = ['standard', 'handicapped', 'motorcycle', 'electric', 'visitor'] as const;

interface ParkingOccupancyChartProps {
  statusData: ReportCategorySlice[];
  typeData: ReportCategorySlice[];
  loading?: boolean;
}

export function ParkingOccupancyChart({
  statusData,
  typeData,
  loading,
}: ParkingOccupancyChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      buildCategoryPie(t, {
        data: statusData,
        labelKey: 'chart.category.status',
        keys: PARKING_STATUSES,
        keyPrefix: 'spaces.parking.statuses',
      }),
      buildCategoryPie(t, {
        data: typeData,
        labelKey: 'chart.category.type',
        keys: PARKING_TYPES,
        keyPrefix: 'spaces.parking.types',
      }),
    ],
    [statusData, typeData, t],
  );

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
      <ReportCategoryPies charts={charts} />
    </ReportSection>
  );
}
