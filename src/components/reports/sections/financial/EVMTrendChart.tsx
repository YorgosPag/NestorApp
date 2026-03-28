'use client';

/**
 * @module reports/sections/financial/EVMTrendChart
 * @enterprise ADR-265 Phase 5 — S-Curve (PV / EV / AC) line chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportChart,
  ReportEmptyState,
} from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { SCurveDataPoint } from '@/services/report-engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EVMTrendChartProps {
  data: SCurveDataPoint[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EVMTrendChart({ data, loading }: EVMTrendChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    plannedValue: {
      label: t('financial.scurve.pv'),
      color: 'hsl(var(--report-chart-1))',
    },
    earnedValue: {
      label: t('financial.scurve.ev'),
      color: 'hsl(var(--report-chart-3))',
    },
    actualCost: {
      label: t('financial.scurve.ac'),
      color: 'hsl(var(--report-chart-6))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('financial.scurve.title')}
        description={t('financial.scurve.description')}
        id="evm-scurve"
      >
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('financial.scurve.title')}
      description={t('financial.scurve.description')}
      id="evm-scurve"
    >
      <ReportChart
        type="line"
        data={data}
        config={chartConfig}
        xAxisKey="date"
        height={350}
      />
    </ReportSection>
  );
}
