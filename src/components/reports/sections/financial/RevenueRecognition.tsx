'use client';

/**
 * @module reports/sections/financial/RevenueRecognition
 * @enterprise ADR-265 Phase 5 — Earned Value by building bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportChart,
  ReportEmptyState,
} from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { RevenueByBuilding } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevenueRecognitionProps {
  data: RevenueByBuilding[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RevenueRecognition({ data, loading }: RevenueRecognitionProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    earnedValue: {
      label: t('financial.revenue.earnedValue'),
      color: 'hsl(var(--report-chart-2))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection
        title={t('financial.revenue.title')}
        description={t('financial.revenue.description')}
        id="revenue-recognition"
      >
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('financial.revenue.title')}
      description={t('financial.revenue.description')}
      id="revenue-recognition"
    >
      <ReportChart
        type="bar"
        data={data}
        config={chartConfig}
        xAxisKey="building"
        height={300}
      />
    </ReportSection>
  );
}
