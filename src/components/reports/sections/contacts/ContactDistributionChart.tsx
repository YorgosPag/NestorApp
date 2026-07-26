'use client';

/**
 * @module reports/sections/contacts/ContactDistributionChart
 * @enterprise ADR-265 — Contacts by type and by status
 * @enterprise ADR-710 §11.6
 */

import '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReportSection,
  ReportCategoryPies,
  ReportEmptyState,
  type ReportCategorySlice,
} from '@/components/reports/core';
import { CONTACT_TYPES } from '@/constants/contact-types';

/** Statuses, as the locale group `contacts.statuses` enumerates them. */
const CONTACT_STATUSES = ['active', 'inactive', 'archived', 'unknown'] as const;

interface ContactDistributionChartProps {
  typeData: ReportCategorySlice[];
  statusData: ReportCategorySlice[];
  loading?: boolean;
}

export function ContactDistributionChart({
  typeData,
  statusData,
  loading,
}: ContactDistributionChartProps) {
  const { t } = useTranslation('reports');

  const charts = useMemo(
    () => [
      {
        data: typeData,
        categoryLabel: t('chart.category.type'),
        // Type vocabulary from the CONTACT_TYPES SSoT; `unknown` is the aggregator fallback.
        categoryOrder: [...CONTACT_TYPES, 'unknown'].map((type) => t(`contacts.types.${type}`)),
      },
      {
        data: statusData,
        categoryLabel: t('chart.category.status'),
        categoryOrder: CONTACT_STATUSES.map((status) => t(`contacts.statuses.${status}`)),
      },
    ],
    [typeData, statusData, t],
  );

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
      <ReportCategoryPies charts={charts} />
    </ReportSection>
  );
}
