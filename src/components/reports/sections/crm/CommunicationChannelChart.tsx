'use client';

/**
 * @module reports/sections/crm/CommunicationChannelChart
 * @enterprise ADR-265 Phase 8 — Communications by channel bar chart
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';
import type { ChannelItem } from './types';

interface CommunicationChannelChartProps {
  data: ChannelItem[];
  loading?: boolean;
}

export function CommunicationChannelChart({ data, loading }: CommunicationChannelChartProps) {
  const { t } = useTranslation('reports');

  const chartConfig: ChartConfig = {
    count: {
      label: t('crm.comms.count'),
      color: 'hsl(var(--report-chart-2))',
    },
  };

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('crm.comms.title')} id="comm-channels">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('crm.comms.title')}
      description={t('crm.comms.description')}
      id="comm-channels"
    >
      <ReportChart
        type="bar"
        data={data}
        config={chartConfig}
        xAxisKey="channel"
        height={300}
      />
    </ReportSection>
  );
}
