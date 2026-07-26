'use client';

/**
 * @module reports/sections/projects/PropertyStatusChart
 * @enterprise ADR-265 Phase 7 — Unit commercial status stacked bar per building
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import { formatNumber } from '@/lib/intl-utils';
import type { PropertyStatusByBuildingItem } from './types';

interface PropertyStatusChartProps {
  data: PropertyStatusByBuildingItem[];
  loading?: boolean;
}

/** Which statuses the rows actually hold — every key except the building name. */
function presentStatuses(data: PropertyStatusByBuildingItem[]): Set<string> {
  const present = new Set<string>();
  for (const item of data) {
    for (const key of Object.keys(item)) {
      if (key !== 'building') present.add(key);
    }
  }
  return present;
}

export function PropertyStatusChart({ data, loading }: PropertyStatusChartProps) {
  const { t } = useTranslation('reports');

  /**
   * Canonical order first, then anything the data holds that the vocabulary does not.
   *
   * Reading the order off the rows — which is what the previous Set iteration did — made
   * the stacking order and every colour depend on which building happened to come first
   * in the response. Unknown statuses are appended rather than dropped: a value the
   * vocabulary has not caught up with must still be counted, not silently lost.
   *
   * The labels also move from `projects.propertyStatus.statuses.*`, which does not exist
   * in either locale, to `projects.unitStatus.statuses.*`, which does. Every legend entry
   * here used to read as its own raw i18n key.
   */
  const series = useMemo<ChartSeries<PropertyStatusByBuildingItem>[]>(() => {
    const present = presentStatuses(data);
    const known = COMMERCIAL_STATUSES.filter((status) => present.has(status));
    const unknown = [...present].filter((status) => !known.includes(status)).sort();

    return [...known, ...unknown].map((status) => ({
      key: status,
      label: t(`projects.unitStatus.statuses.${status}`),
    }));
  }, [data, t]);

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('projects.propertyStatus.title')} id="unit-status">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('projects.propertyStatus.title')}
      description={t('projects.propertyStatus.description')}
      id="unit-status"
    >
      <ReportChart
        type="stacked-bar"
        data={data}
        series={series}
        categoryKey="building"
        categoryLabel={t('chart.category.building')}
        formatValue={formatNumber}
        size="lg"
      />
    </ReportSection>
  );
}
