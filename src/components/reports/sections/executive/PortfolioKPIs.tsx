'use client';

/**
 * @module reports/sections/executive/PortfolioKPIs
 * @enterprise ADR-265 Phase 4 — 8 KPI cards for executive overview
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportKPIGrid, ReportSection, type ReportKPI } from '@/components/reports/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortfolioKPIsProps {
  kpis: ReportKPI[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Loading skeleton — 8 placeholder cards
// ---------------------------------------------------------------------------

const SKELETON_KPIS: ReportKPI[] = Array.from({ length: 8 }, () => ({
  title: '',
  value: '',
  icon: () => null,
  loading: true,
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioKPIs({ kpis, loading }: PortfolioKPIsProps) {
  const { t } = useTranslation('reports');

  return (
    <ReportSection
      title={t('executive.kpis.title')}
      id="portfolio-kpis"
      collapsible={false}
    >
      <ReportKPIGrid
        kpis={loading ? SKELETON_KPIS : kpis}
        columns={4}
      />
    </ReportSection>
  );
}
