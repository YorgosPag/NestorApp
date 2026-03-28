'use client';

/**
 * @module reports/sections/construction/ConstructionKPIs
 * @enterprise ADR-265 Phase 11 — 8 Construction KPI cards
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportKPIGrid, ReportSection, type ReportKPI } from '@/components/reports/core';

interface ConstructionKPIsProps {
  kpis: ReportKPI[];
  loading?: boolean;
}

const SKELETON_KPIS: ReportKPI[] = Array.from({ length: 8 }, () => ({
  title: '',
  value: '',
  icon: () => null,
  loading: true,
}));

export function ConstructionKPIs({ kpis, loading }: ConstructionKPIsProps) {
  const { t } = useTranslation('reports');

  return (
    <ReportSection
      title={t('construction.kpis.title')}
      id="construction-kpis"
      collapsible={false}
    >
      <ReportKPIGrid kpis={loading ? SKELETON_KPIS : kpis} columns={4} />
    </ReportSection>
  );
}
