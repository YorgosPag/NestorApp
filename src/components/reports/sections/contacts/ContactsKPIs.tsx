'use client';

/**
 * @module reports/sections/contacts/ContactsKPIs
 * @enterprise ADR-265 Phase 9 — 8 Contact KPI cards
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportKPIGrid, ReportSection, type ReportKPI } from '@/components/reports/core';

interface ContactsKPIsProps {
  kpis: ReportKPI[];
  loading?: boolean;
}

const SKELETON_KPIS: ReportKPI[] = Array.from({ length: 8 }, () => ({
  title: '',
  value: '',
  icon: () => null,
  loading: true,
}));

export function ContactsKPIs({ kpis, loading }: ContactsKPIsProps) {
  const { t } = useTranslation('reports');

  return (
    <ReportSection
      title={t('contacts.kpis.title')}
      id="contacts-kpis"
      collapsible={false}
    >
      <ReportKPIGrid kpis={loading ? SKELETON_KPIS : kpis} columns={4} />
    </ReportSection>
  );
}
