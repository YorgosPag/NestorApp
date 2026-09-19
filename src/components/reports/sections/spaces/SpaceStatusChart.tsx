'use client';

/**
 * @module reports/sections/spaces/SpaceStatusChart
 * @enterprise ADR-777 §8.60.20 · ADR-265 · ADR-710 §11.6
 *
 * Η ενότητα αναφοράς ενός είδους χώρου (θέσεις · αποθήκες): δύο πίτες κατάστασης (διάθεση ·
 * λειτουργία) + μία πίτα τύπου. Ήταν **δύο** σχεδόν ίδια components (`ParkingOccupancyChart` /
 * `StorageUtilizationChart`)· το `jscpd:diff` (CHECK 3.28) τα έπιασε όταν η §8.60.20 άγγιξε και τα
 * δύο. Κάθε χώρος δίνει πλέον μόνο το είδος του, το id της ενότητας και το λεξιλόγιο τύπων.
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
import {
  buildSpaceStatusPies,
  hasSpaceStatusData,
  type SpaceStatusPieData,
} from './space-status-pies';

export interface SpaceStatusChartData extends SpaceStatusPieData {
  typeData: ReportCategorySlice[];
  loading?: boolean;
}

export interface SpaceStatusChartProps extends SpaceStatusChartData {
  /** Το είδος — ορίζει τα κλειδιά `spaces.<kind>.{title,description,types}`. */
  readonly kind: 'parking' | 'storage';
  readonly sectionId: string;
  /** Το λεξιλόγιο τύπων, όπως το απαριθμεί το locale. */
  readonly typeKeys: readonly string[];
}

export function SpaceStatusChart({
  kind,
  sectionId,
  typeKeys,
  commercialData,
  operationalData,
  typeData,
  loading,
}: SpaceStatusChartProps) {
  const { t } = useTranslation('reports');

  const statusCharts = useMemo(
    () => buildSpaceStatusPies(t, { commercialData, operationalData }),
    [commercialData, operationalData, t],
  );
  const typeCharts = useMemo(
    () => [
      buildCategoryPie(t, {
        data: typeData,
        labelKey: 'chart.category.type',
        keys: typeKeys,
        keyPrefix: `spaces.${kind}.types`,
      }),
    ],
    [kind, typeData, typeKeys, t],
  );

  const hasData = hasSpaceStatusData({ commercialData, operationalData }) || typeData.length > 0;

  if (!loading && !hasData) {
    return (
      <ReportSection title={t(`spaces.${kind}.title`)} id={sectionId}>
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection title={t(`spaces.${kind}.title`)} description={t(`spaces.${kind}.description`)} id={sectionId}>
      <ReportCategoryPies charts={statusCharts} />
      <ReportCategoryPies charts={typeCharts} />
    </ReportSection>
  );
}
