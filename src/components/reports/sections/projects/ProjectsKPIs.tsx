'use client';

/**
 * @module reports/sections/projects/ProjectsKPIs
 * @enterprise ADR-265 Phase 7 — 8 Portfolio KPI cards
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { ReportKPIGrid, ReportSection, type ReportKPI } from '@/components/reports/core';

interface ProjectsKPIsProps {
  kpis: ReportKPI[];
  loading?: boolean;
}

const SKELETON_KPIS: ReportKPI[] = Array.from({ length: 8 }, () => ({
  title: '',
  value: '',
  icon: () => null,
  loading: true,
}));

export function ProjectsKPIs({ kpis, loading }: ProjectsKPIsProps) {
  const { t } = useTranslation('reports');

  return (
    <ReportSection
      title={t('projects.kpis.title')}
      id="projects-kpis"
      collapsible={false}
    >
      <ReportKPIGrid kpis={loading ? SKELETON_KPIS : kpis} columns={4} />
    </ReportSection>
  );
}
