'use client';

/**
 * @module reports/sections/contacts/ContactDistributionChart
 * @enterprise ADR-265 Phase 9 — Contacts by type & status pie charts
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportSection, ReportChart, ReportEmptyState } from '@/components/reports/core';
import type { ChartConfig } from '@/components/ui/chart';

interface ContactDistributionChartProps {
  typeData: { name: string; value: number }[];
  statusData: { name: string; value: number }[];
  loading?: boolean;
}

export function ContactDistributionChart({ typeData, statusData, loading }: ContactDistributionChartProps) {
  const { t } = useTranslation('reports');

  const typeConfig: ChartConfig = {
    individual: { label: t('contacts.types.individual'), color: 'hsl(var(--report-chart-1))' },
    company: { label: t('contacts.types.company'), color: 'hsl(var(--report-chart-2))' },
    service: { label: t('contacts.types.service'), color: 'hsl(var(--report-chart-3))' },
  };

  const statusConfig: ChartConfig = {
    active: { label: t('contacts.statuses.active'), color: 'hsl(var(--report-chart-3))' },
    inactive: { label: t('contacts.statuses.inactive'), color: 'hsl(var(--report-chart-4))' },
    archived: { label: t('contacts.statuses.archived'), color: 'hsl(var(--report-chart-6))' },
  };

  const hasData = typeData.length > 0 || statusData.length > 0;

  if (!loading && !hasData) {
    return (
      <ReportSection title={t('contacts.distribution.title')} id="contact-distribution">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('contacts.distribution.title')}
      description={t('contacts.distribution.description')}
      id="contact-distribution"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {typeData.length > 0 && (
          <ReportChart type="pie" data={typeData} config={typeConfig} height={280} />
        )}
        {statusData.length > 0 && (
          <ReportChart type="pie" data={statusData} config={statusConfig} height={280} />
        )}
      </div>
    </ReportSection>
  );
}
