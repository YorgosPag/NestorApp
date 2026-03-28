'use client';

/**
 * @module reports/sections/compliance/ComplianceKPIs
 * @enterprise ADR-265 Phase 12 — 6 Compliance KPI cards
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportKPIGrid, ReportSection, type ReportKPI } from '@/components/reports/core';

interface ComplianceKPIsProps {
  kpis: ReportKPI[];
  loading?: boolean;
}

const SKELETON_KPIS: ReportKPI[] = Array.from({ length: 6 }, () => ({
  title: '',
  value: '',
  icon: () => null,
  loading: true,
}));

export function ComplianceKPIs({ kpis, loading }: ComplianceKPIsProps) {
  const { t } = useTranslation('reports');

  return (
    <ReportSection
      title={t('compliance.kpis.title')}
      id="compliance-kpis"
      collapsible={false}
    >
      <ReportKPIGrid kpis={loading ? SKELETON_KPIS : kpis} columns={3} />
    </ReportSection>
  );
}
