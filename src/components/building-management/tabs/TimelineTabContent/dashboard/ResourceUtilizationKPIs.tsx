'use client';

/**
 * @module ResourceUtilizationKPIs
 * @enterprise ADR-266 Phase C, Sub-phase 4 — Resource Utilization KPI Cards
 *
 * Shows: Total Resources, Avg Utilization %, Over-Allocated Count.
 * Follows ScheduleOverviewKPIs pattern using ReportKPIGrid.
 */

import { Users, BarChart3, AlertTriangle } from 'lucide-react';
import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportKPIGrid } from '@/components/reports/core/ReportKPIGrid';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ReportKPI } from '@/components/reports/core/ReportKPIGrid';
import type { RAGStatus } from '@/components/reports/core/ReportTrafficLight';
import type { ResourceUtilizationKPI } from './resource-histogram.types';

// ─── Props ───────────────────────────────────────────────────────────────

interface ResourceUtilizationKPIsProps {
  utilization: ResourceUtilizationKPI;
  loading?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────

export function ResourceUtilizationKPIs({ utilization, loading }: ResourceUtilizationKPIsProps) {
  const { t } = useTranslation('building');
  const tBase = 'tabs.timeline.dashboard.resourceUtilization';

  const overRAG: RAGStatus = utilization.overAllocatedCount === 0
    ? 'green'
    : utilization.overAllocatedCount <= 2
      ? 'amber'
      : 'red';

  const utilizationRAG: RAGStatus = utilization.avgUtilization <= 85
    ? 'green'
    : utilization.avgUtilization <= 100
      ? 'amber'
      : 'red';

  const kpis: ReportKPI[] = [
    {
      title: t(`${tBase}.totalResources`),
      value: utilization.totalResources,
      icon: Users,
      color: 'blue',
      loading,
    },
    {
      title: t(`${tBase}.avgUtilization`),
      value: `${utilization.avgUtilization}%`,
      icon: BarChart3,
      color: utilizationRAG === 'green' ? 'green' : utilizationRAG === 'amber' ? 'orange' : 'red',
      status: utilizationRAG,
      loading,
    },
    {
      title: t(`${tBase}.overAllocated`),
      value: utilization.overAllocatedCount,
      icon: AlertTriangle,
      color: overRAG === 'green' ? 'green' : overRAG === 'amber' ? 'orange' : 'red',
      status: overRAG,
      loading,
    },
  ];

  return (
    <ReportSection title={t(`${tBase}.title`)} id="resource-utilization">
      <ReportKPIGrid kpis={kpis} />
    </ReportSection>
  );
}
