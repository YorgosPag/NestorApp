'use client';

/**
 * @module reports/sections/sales/ConversionFunnelChart
 * @enterprise ADR-265 Phase 6 — Sales conversion funnel
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportFunnel, ReportEmptyState } from '@/components/reports/core';
import type { FunnelStage } from '@/components/reports/core';

interface ConversionFunnelChartProps {
  data: FunnelStage[];
  loading?: boolean;
}

export function ConversionFunnelChart({ data, loading }: ConversionFunnelChartProps) {
  const { t } = useTranslation('reports');

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('sales.funnel.title')} id="conversion-funnel">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('sales.funnel.title')}
      description={t('sales.funnel.description')}
      id="conversion-funnel"
    >
      <ReportFunnel
        data={data}
        height={300}
        formatValue={(v) =>
          new Intl.NumberFormat('el-GR').format(v)
        }
      />
    </ReportSection>
  );
}
