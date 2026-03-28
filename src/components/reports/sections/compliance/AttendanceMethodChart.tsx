'use client';

/**
 * @module reports/sections/compliance/AttendanceMethodChart
 * @enterprise ADR-265 Phase 12 — Check-ins by method (QR, geofence, manual, NFC)
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface AttendanceMethodChartProps {
  data: { name: string; value: number }[];
  loading?: boolean;
}

export function AttendanceMethodChart({ data, loading }: AttendanceMethodChartProps) {
  const { t } = useTranslation('reports');

  const config: ChartConfig = {
    manual: { label: t('compliance.methods.manual'), color: 'hsl(var(--report-chart-1))' },
    qr: { label: t('compliance.methods.qr'), color: 'hsl(var(--report-chart-2))' },
    geofence: { label: t('compliance.methods.geofence'), color: 'hsl(var(--report-chart-3))' },
    nfc: { label: t('compliance.methods.nfc'), color: 'hsl(var(--report-chart-4))' },
  };

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
      <ReportChart type="pie" data={data} config={config} height={280} />
    </ReportSection>
  );
}
