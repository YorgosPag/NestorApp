'use client';

/**
 * @module reports/sections/crm/LeadSourceChart
 * @enterprise ADR-265 — Leads by source
 * @enterprise ADR-710 §11.6
 *
 * The slice colour used to be `--report-chart-${(n % 8) + 1}` — the row position, wrapped.
 * A source that stops producing leads therefore repainted every source below it, and the
 * wrap meant a ninth source silently took the colour of the first.
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  ReportEmptyState,
} from '@/components/reports/core';
import type { SourceItem } from './types';

/**
 * Lead sources, mirroring the `source` union on a CRM opportunity
 * (`src/types/crm.ts`), plus the aggregator fallback.
 */
const LEAD_SOURCES = [
  'website',
  'referral',
  'agent',
  'social',
  'phone',
  'walkin',
  'unknown',
] as const;

interface LeadSourceChartProps {
  data: SourceItem[];
  loading?: boolean;
}

export function LeadSourceChart({ data, loading }: LeadSourceChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      {
        data,
        categoryLabel: t('chart.category.source'),
        categoryOrder: LEAD_SOURCES.map((source) => t(`crm.sources.${source}`)),
      },
    ],
    [data, t],
  );

  if (!loading && data.length === 0) {
    return (
      <ReportSection title={t('crm.leads.title')} id="lead-source">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('crm.leads.title')}
      description={t('crm.leads.description')}
      id="lead-source"
    >
      <ReportCategoryPies charts={charts} size="md" />
    </ReportSection>
  );
}
