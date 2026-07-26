'use client';

/**
 * @module reports/sections/spaces/ParkingZoneChart
 * @enterprise ADR-265 — Parking spaces by zone
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

/** Parking zones, as the locale group `spaces.parking.zones` enumerates them. */
const PARKING_ZONES = [
  'pilotis',
  'underground',
  'open_space',
  'rooftop',
  'covered_outdoor',
] as const;

interface ParkingZoneChartProps {
  data: ReportCategorySlice[];
  loading?: boolean;
}

export function ParkingZoneChart({ data, loading }: ParkingZoneChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      buildCategoryPie(t, {
        data,
        labelKey: 'chart.category.zone',
        keys: PARKING_ZONES,
        keyPrefix: 'spaces.parking.zones',
      }),
    ],
    [data, t],
  );

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
      <ReportCategoryPies charts={charts} />
    </ReportSection>
  );
}
