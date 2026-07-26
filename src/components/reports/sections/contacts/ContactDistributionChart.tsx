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
  buildCategoryPie,
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
      // Type vocabulary from the CONTACT_TYPES SSoT; `unknown` is the aggregator fallback.
      buildCategoryPie(t, {
        data: typeData,
        labelKey: 'chart.category.type',
        keys: [...CONTACT_TYPES, 'unknown'],
        keyPrefix: 'contacts.types',
      }),
      buildCategoryPie(t, {
        data: statusData,
        labelKey: 'chart.category.status',
        keys: CONTACT_STATUSES,
        keyPrefix: 'contacts.statuses',
      }),
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
