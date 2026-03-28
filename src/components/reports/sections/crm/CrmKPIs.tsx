'use client';

/**
 * @module reports/sections/crm/CrmKPIs
 * @enterprise ADR-265 Phase 8 — 8 CRM KPI cards
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportKPIGrid, ReportSection, type ReportKPI } from '@/components/reports/core';

interface CrmKPIsProps {
  kpis: ReportKPI[];
  loading?: boolean;
}

const SKELETON_KPIS: ReportKPI[] = Array.from({ length: 8 }, () => ({
  title: '',
  value: '',
  icon: () => null,
  loading: true,
}));

export function CrmKPIs({ kpis, loading }: CrmKPIsProps) {
  const { t } = useTranslation('reports');

  return (
    <ReportSection
      title={t('crm.kpis.title')}
      id="crm-kpis"
      collapsible={false}
    >
      <ReportKPIGrid kpis={loading ? SKELETON_KPIS : kpis} columns={4} />
    </ReportSection>
  );
}
