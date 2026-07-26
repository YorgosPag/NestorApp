'use client';

/**
 * @module reports/sections/compliance/AttendanceMethodChart
 * @enterprise ADR-265 — Check-ins by method
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

/** Check-in methods, as the locale group `compliance.methods` enumerates them. */
const CHECK_IN_METHODS = ['manual', 'qr', 'geofence', 'nfc', 'unknown'] as const;

interface AttendanceMethodChartProps {
  data: ReportCategorySlice[];
  loading?: boolean;
}

export function AttendanceMethodChart({ data, loading }: AttendanceMethodChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      buildCategoryPie(t, {
        data,
        labelKey: 'chart.category.method',
        keys: CHECK_IN_METHODS,
        keyPrefix: 'compliance.methods',
      }),
    ],
    [data, t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('compliance.attendance.title')} id="attendance-method">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('compliance.attendance.title')}
      description={t('compliance.attendance.description')}
      id="attendance-method"
    >
      <ReportCategoryPies charts={charts} />
    </ReportSection>
  );
}
