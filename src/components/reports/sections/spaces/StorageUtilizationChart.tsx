'use client';

/**
 * @module reports/sections/spaces/StorageUtilizationChart
 * @enterprise ADR-265 — Storage spaces by status and by type
 * @enterprise ADR-710 §11.6
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  ReportEmptyState,
  type ReportCategorySlice,
} from '@/components/reports/core';

/** Both vocabularies, as the locale groups under `spaces.storage` enumerate them. */
const STORAGE_STATUSES = [
  'available',
  'occupied',
  'maintenance',
  'reserved',
  'sold',
  'unavailable',
] as const;

const STORAGE_TYPES = [
  'large',
  'small',
  'basement',
  'ground',
  'special',
  'storage',
  'garage',
  'warehouse',
] as const;

interface StorageUtilizationChartProps {
  statusData: ReportCategorySlice[];
  typeData: ReportCategorySlice[];
  loading?: boolean;
}

export function StorageUtilizationChart({
  statusData,
  typeData,
  loading,
}: StorageUtilizationChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      {
        data: statusData,
        categoryLabel: t('chart.category.status'),
        categoryOrder: STORAGE_STATUSES.map((status) => t(`spaces.storage.statuses.${status}`)),
      },
      {
        data: typeData,
        categoryLabel: t('chart.category.type'),
        categoryOrder: STORAGE_TYPES.map((type) => t(`spaces.storage.types.${type}`)),
      },
    ],
    [statusData, typeData, t],
  );

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
      <ReportCategoryPies charts={charts} />
    </ReportSection>
  );
}
