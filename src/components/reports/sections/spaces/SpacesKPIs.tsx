'use client';

/**
 * @module reports/sections/spaces/SpacesKPIs
 * @enterprise ADR-265 Phase 10 — 8 Space KPI cards
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportKPIGrid, ReportSection, type ReportKPI } from '@/components/reports/core';

interface SpacesKPIsProps {
  kpis: ReportKPI[];
  loading?: boolean;
}

const SKELETON_KPIS: ReportKPI[] = Array.from({ length: 10 }, () => ({
  title: '',
  value: '',
  icon: () => null,
  loading: true,
}));

export function SpacesKPIs({ kpis, loading }: SpacesKPIsProps) {
  const { t } = useTranslation('reports');

  return (
    <ReportSection
      title={t('spaces.kpis.title')}
      id="spaces-kpis"
      collapsible={false}
    >
      <ReportKPIGrid kpis={loading ? SKELETON_KPIS : kpis} columns={4} />
    </ReportSection>
  );
}
