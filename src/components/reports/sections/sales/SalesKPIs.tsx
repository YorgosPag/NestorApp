'use client';

/**
 * @module reports/sections/sales/SalesKPIs
 * @enterprise ADR-265 Phase 6 — 8 Sales KPI cards
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportKPIGrid, ReportSection, type ReportKPI } from '@/components/reports/core';

interface SalesKPIsProps {
  kpis: ReportKPI[];
  loading?: boolean;
}

const SKELETON_KPIS: ReportKPI[] = Array.from({ length: 8 }, () => ({
  title: '',
  value: '',
  icon: () => null,
  loading: true,
}));

export function SalesKPIs({ kpis, loading }: SalesKPIsProps) {
  const { t } = useTranslation('reports');

  return (
    <ReportSection
      title={t('sales.kpis.title')}
      id="sales-kpis"
      collapsible={false}
    >
      <ReportKPIGrid kpis={loading ? SKELETON_KPIS : kpis} columns={4} />
    </ReportSection>
  );
}
