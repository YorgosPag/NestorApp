'use client';

/**
 * @module reports/sections/crm/CommunicationChannelChart
 * @enterprise ADR-265 — Communications by channel
 * @enterprise ADR-710 Φάση Γ
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartSeries } from '@/components/ui/chart-card';
import { formatNumber } from '@/lib/intl-utils';
import type { ChannelItem } from './types';

interface CommunicationChannelChartProps {
  data: ChannelItem[];
  loading?: boolean;
}

export function CommunicationChannelChart({ data, loading }: CommunicationChannelChartProps) {
  const { t } = useTranslation('reports');

  const series = useMemo<ChartSeries<ChannelItem>[]>(
    () => [{ key: 'count', label: t('crm.comms.count') }],
    [t],
  );

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
        series={series}
        categoryKey="channel"
        categoryLabel={t('chart.category.channel')}
        formatValue={formatNumber}
      />
    </ReportSection>
  );
}
