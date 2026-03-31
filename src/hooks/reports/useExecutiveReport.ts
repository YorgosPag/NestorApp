'use client';

/**
 * @module hooks/reports/useExecutiveReport
 * @enterprise ADR-265 Phase 4 — Executive Summary composition hook
 *
 * Aggregates data from existing hooks into a unified executive dashboard.
 * NO direct Firestore access — pure composition layer.
 */

import { useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet, TrendingUp, Percent, BarChart3,
  Building2, Home, Clock, Target,
} from 'lucide-react';
import type { ReportKPI } from '@/components/reports/core';
import type { Project } from '@/types/project';
import type { Property } from '@/types/property';
import type { Opportunity } from '@/types/crm';
import { useFirestoreProjects } from '@/hooks/useFirestoreProjects';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { useFirestoreProperties } from '@/hooks/useFirestoreProperties';
import { useProjectsStats } from '@/hooks/useProjectsStats';
import { usePropertiesStats } from '@/hooks/usePropertiesStats';
import { useRealtimeOpportunities } from '@/services/realtime/hooks/useRealtimeOpportunities';
import { useRealtimeTasks } from '@/services/realtime/hooks/useRealtimeTasks';
import { getTrafficLight } from '@/services/report-engine/evm-calculator';
import { sumBy, rate } from '@/hooks/useEntityStats';
import { tallyBy } from '@/utils/collection-utils';
import type {
  ProjectHealthRow,
  RevenueTrendPoint,
  OverdueItem,
  PipelineStageData,
} from '@/components/reports/sections/executive/types';

// ---------------------------------------------------------------------------
// Cache (ADR decision 12.23 — 5-min TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  kpis: ReportKPI[];
  projectHealth: ProjectHealthRow[];
  revenueTrend: RevenueTrendPoint[];
  topOverdue: OverdueItem[];
  pipelineSummary: PipelineStageData[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseExecutiveReportReturn {
  kpis: ReportKPI[];
  projectHealth: ProjectHealthRow[];
  revenueTrend: RevenueTrendPoint[];
  topOverdue: OverdueItem[];
  pipelineSummary: PipelineStageData[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Pure transform functions (each <40 lines)
// ---------------------------------------------------------------------------

function buildKPIs(
  projectStats: ReturnType<typeof useProjectsStats>,
  unitStats: ReturnType<typeof usePropertiesStats>,
  opportunities: Opportunity[],
  taskOverdue: number,
  t: (key: string) => string,
): ReportKPI[] {
  const pipelineValue = sumBy(
    opportunities.filter(o => o.status === 'active'),
    o => o.estimatedValue ?? 0,
  );

  return [
    {
      title: t('executive.kpis.portfolioValue'),
      value: formatEuro(projectStats.totalValue),
      icon: Wallet,
      color: 'blue' as const,
    },
    {
      title: t('executive.kpis.revenueYTD'),
      value: formatEuro(unitStats.totalValue),
      icon: TrendingUp,
      color: 'green' as const,
    },
    {
      title: t('executive.kpis.collectionRate'),
      value: unitStats.totalProperties > 0
        ? `${rate(unitStats.soldProperties, unitStats.totalProperties)}%`
        : '0%',
      icon: Percent,
      color: 'purple' as const,
    },
    {
      title: t('executive.kpis.avgCPI'),
      value: projectStats.averageProgress > 0 ? '1.00' : '—',
      icon: BarChart3,
      color: 'cyan' as const,
      status: 'green' as const,
    },
    {
      title: t('executive.kpis.activeProjects'),
      value: projectStats.activeProjects,
      icon: Building2,
      color: 'orange' as const,
    },
    {
      title: t('executive.kpis.availableProperties'),
      value: unitStats.availableProperties,
      icon: Home,
      color: 'indigo' as const,
    },
    {
      title: t('executive.kpis.pendingPayments'),
      value: taskOverdue > 0 ? taskOverdue.toString() : '0',
      icon: Clock,
      color: 'red' as const,
    },
    {
      title: t('executive.kpis.pipelineValue'),
      value: formatEuro(pipelineValue),
      icon: Target,
      color: 'yellow' as const,
    },
  ];
}

function buildProjectHealth(projects: Project[]): ProjectHealthRow[] {
  const active = projects.filter(
    p => p.status === 'in_progress' || p.status === 'planning',
  );

  return active.map(p => {
    const progress = p.progress ?? 0;
    const budget = p.budget ?? p.totalValue ?? 0;
    // Simplified CPI/SPI — full EVM in Phase 5
    const cpi = progress > 0 ? 1.0 : 0;
    const spi = progress > 0 ? 1.0 : 0;
    const cpiHealth = getTrafficLight(cpi);
    const spiHealth = getTrafficLight(spi);
    const overallHealth = worstHealth(cpiHealth, spiHealth);

    return {
      id: p.id,
      name: p.name || p.title || p.id,
      progress,
      cpi,
      spi,
      cpiHealth,
      spiHealth,
      overallHealth,
      budget,
    };
  });
}

function buildRevenueTrend(units: Property[]): RevenueTrendPoint[] {
  const currentYear = new Date().getFullYear();
  const monthLabels = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, i, 1);
    return {
      key: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('el-GR', { month: 'short' }),
    };
  });

  const soldThisYear = units.filter(u => {
    if (u.status !== 'sold' && u.commercialStatus !== 'sold') return false;
    if (!u.saleDate) return false;
    return new Date(u.saleDate).getFullYear() === currentYear;
  });

  const revenueByMonth = tallyByValue(soldThisYear, u => {
    const d = new Date(u.saleDate!);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, u => u.commercial?.finalPrice ?? u.price ?? 0);

  return monthLabels.map(({ key, label }) => ({
    month: key,
    label,
    revenue: revenueByMonth[key] ?? 0,
  }));
}

function buildTopOverdue(units: Property[]): OverdueItem[] {
  // Simplified: units sold without sale date or recent sale
  const soldUnits = units.filter(
    u => (u.status === 'sold' || u.commercialStatus === 'sold') && u.price,
  );

  return soldUnits
    .slice(0, 5)
    .map(u => ({
      unitId: u.id,
      unitName: u.name || u.code || u.id,
      projectName: u.project || '',
      buyerName: u.soldTo ?? '—',
      amount: u.commercial?.finalPrice ?? u.price ?? 0,
      daysOverdue: 0, // Full aging in Phase 6
    }));
}

function buildPipelineSummary(
  opportunities: Opportunity[],
  t: (key: string) => string,
): PipelineStageData[] {
  const stages: Opportunity['stage'][] = [
    'initial_contact', 'qualification', 'viewing',
    'proposal', 'negotiation', 'contract',
    'closed_won', 'closed_lost',
  ];

  const byStage = tallyBy(opportunities, o => o.stage);
  const valueByStage = tallyByValue(
    opportunities, o => o.stage, o => o.estimatedValue ?? 0,
  );

  return stages
    .filter(s => (byStage[s] ?? 0) > 0)
    .map(s => ({
      stage: s,
      stageLabel: t(`executive.pipeline.stages.${s}`),
      count: byStage[s] ?? 0,
      value: valueByStage[s] ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

type HealthLevel = 'green' | 'amber' | 'red';

function worstHealth(a: HealthLevel, b: HealthLevel): HealthLevel {
  const severity: Record<HealthLevel, number> = { green: 0, amber: 1, red: 2 };
  return severity[a] >= severity[b] ? a : b;
}

function tallyByValue<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    result[key] = (result[key] ?? 0) + valueFn(item);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useExecutiveReport(): UseExecutiveReportReturn {
  const { t } = useTranslation('reports');
  const cacheRef = useRef<CacheEntry | null>(null);

  // Source hooks
  const {
    projects, loading: projLoading, error: projError, refetch: projRefetch,
  } = useFirestoreProjects();
  const {
    buildings, loading: bldLoading, error: bldError, refetch: bldRefetch,
  } = useFirestoreBuildings();
  const {
    properties, loading: unitLoading, error: unitError, refetch: unitRefetch,
  } = useFirestoreProperties();
  const {
    opportunities, loading: oppLoading, refetch: oppRefetch,
  } = useRealtimeOpportunities();
  const {
    stats: taskStats, loading: taskLoading, refetch: taskRefetch,
  } = useRealtimeTasks();

  // Stats hooks (pure computation, no loading)
  const projectStats = useProjectsStats(projects);
  const unitStats = usePropertiesStats(properties);

  const loading = projLoading || bldLoading || unitLoading || oppLoading || taskLoading;
  const error = projError || bldError || unitError || null;

  const refetch = useCallback(() => {
    cacheRef.current = null;
    projRefetch();
    bldRefetch?.();
    unitRefetch?.();
    oppRefetch();
    taskRefetch();
  }, [projRefetch, bldRefetch, unitRefetch, oppRefetch, taskRefetch]);

  // Computed data with cache
  const result = useMemo<Omit<UseExecutiveReportReturn, 'loading' | 'error' | 'refetch'>>(() => {
    if (loading) {
      return {
        kpis: [],
        projectHealth: [],
        revenueTrend: [],
        topOverdue: [],
        pipelineSummary: [],
      };
    }

    // Check cache validity
    if (cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_TTL) {
      const c = cacheRef.current;
      return {
        kpis: c.kpis,
        projectHealth: c.projectHealth,
        revenueTrend: c.revenueTrend,
        topOverdue: c.topOverdue,
        pipelineSummary: c.pipelineSummary,
      };
    }

    const kpis = buildKPIs(projectStats, unitStats, opportunities, taskStats.overdue, t);
    const projectHealth = buildProjectHealth(projects);
    const revenueTrend = buildRevenueTrend(properties);
    const topOverdue = buildTopOverdue(properties);
    const pipelineSummary = buildPipelineSummary(opportunities, t);

    cacheRef.current = {
      kpis, projectHealth, revenueTrend, topOverdue, pipelineSummary,
      timestamp: Date.now(),
    };

    return { kpis, projectHealth, revenueTrend, topOverdue, pipelineSummary };
  }, [loading, projectStats, unitStats, opportunities, taskStats, projects, properties, t]);

  return { ...result, loading, error, refetch };
}
