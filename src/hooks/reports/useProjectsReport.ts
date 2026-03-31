'use client';

/**
 * @module hooks/reports/useProjectsReport
 * @enterprise ADR-265 Phase 7 — Projects & Buildings Report hook
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FolderKanban, Wallet, TrendingUp, Building2,
  ShoppingCart, Home, Layers, Zap,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type {
  ProjectsReportPayload,
  RevenueByProjectItem,
  PropertyStatusByBuildingItem,
  EnergyClassItem,
} from '@/components/reports/sections/projects/types';
import type { ProjectProgressItem, PricePerSqmItem, BOQVarianceItem } from '@/services/report-engine';
import { getErrorMessage } from '@/lib/error-utils';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL = 5 * 60 * 1000;

interface CachedData {
  payload: ProjectsReportPayload;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseProjectsReportReturn {
  kpis: ReportKPI[];
  statusPie: { name: string; value: number }[];
  projectProgress: ProjectProgressItem[];
  unitStatusByBuilding: PropertyStatusByBuildingItem[];
  revenueByProject: RevenueByProjectItem[];
  pricePerSqm: PricePerSqmItem[];
  boqVariance: BOQVarianceItem[];
  energyClassData: EnergyClassItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Pure transforms (<40 lines each)
// ---------------------------------------------------------------------------

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildProjectKPIs(
  data: ProjectsReportPayload,
  t: (key: string) => string,
): ReportKPI[] {
  const sold = data.unitsByCommercialStatus['sold'] ?? 0;
  const available = data.unitsByCommercialStatus['for-sale'] ?? 0;
  const typeCount = Object.keys(data.unitsByType).filter(k => k !== 'unknown').length;
  const energyRated = Object.entries(data.energyClassDistribution)
    .filter(([k]) => k !== 'unknown')
    .reduce((sum, [, v]) => sum + v, 0);

  return [
    { title: t('projects.kpis.totalProjects'), value: data.totalProjects, icon: FolderKanban, color: 'blue' as const },
    { title: t('projects.kpis.portfolioValue'), value: formatEuro(data.totalPortfolioValue), icon: Wallet, color: 'green' as const },
    { title: t('projects.kpis.averageProgress'), value: `${data.averageProgress}%`, icon: TrendingUp, color: 'cyan' as const },
    { title: t('projects.kpis.totalUnits'), value: data.totalUnits, icon: Building2, color: 'purple' as const },
    { title: t('projects.kpis.soldUnits'), value: sold, icon: ShoppingCart, color: 'orange' as const },
    { title: t('projects.kpis.availableUnits'), value: available, icon: Home, color: 'indigo' as const },
    { title: t('projects.kpis.unitTypes'), value: typeCount, icon: Layers, color: 'pink' as const },
    { title: t('projects.kpis.energyRated'), value: energyRated, icon: Zap, color: 'yellow' as const },
  ];
}

function buildStatusPie(
  byStatus: Record<string, number>,
  t: (key: string) => string,
): { name: string; value: number }[] {
  return Object.entries(byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: t(`projects.status.statuses.${status}`),
      value: count,
    }));
}

function buildRevenueItems(
  revenueByProject: Record<string, number>,
): RevenueByProjectItem[] {
  return Object.entries(revenueByProject)
    .filter(([, revenue]) => revenue > 0)
    .map(([project, revenue]) => ({ project, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

function buildUnitStatusItems(
  unitsByBuilding: Record<string, Record<string, number>>,
): PropertyStatusByBuildingItem[] {
  return Object.entries(unitsByBuilding).map(([building, statuses]) => ({
    building,
    ...statuses,
  }));
}

function buildEnergyClassItems(
  distribution: Record<string, number>,
): EnergyClassItem[] {
  return Object.entries(distribution)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useProjectsReport(): UseProjectsReportReturn {
  const { t } = useTranslation('reports');
  const cacheRef = useRef<CachedData | null>(null);
  const [payload, setPayload] = useState<ProjectsReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (!force && cacheRef.current) {
      const age = Date.now() - cacheRef.current.timestamp;
      if (age < CACHE_TTL) {
        setPayload(cacheRef.current.payload);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<ProjectsReportPayload>(
        '/api/reports/projects',
      );
      cacheRef.current = { payload: data, timestamp: Date.now() };
      setPayload(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  // Derived view-models
  const kpis = useMemo(
    () => payload ? buildProjectKPIs(payload, t) : [],
    [payload, t],
  );
  const statusPie = useMemo(
    () => payload ? buildStatusPie(payload.byStatus, t) : [],
    [payload, t],
  );
  const revenueByProject = useMemo(
    () => payload ? buildRevenueItems(payload.revenueByProject) : [],
    [payload],
  );
  const unitStatusByBuilding = useMemo(
    () => payload ? buildUnitStatusItems(payload.unitsByBuilding) : [],
    [payload],
  );
  const energyClassData = useMemo(
    () => payload ? buildEnergyClassItems(payload.energyClassDistribution) : [],
    [payload],
  );

  return {
    kpis,
    statusPie,
    projectProgress: payload?.projectProgress ?? [],
    unitStatusByBuilding,
    revenueByProject,
    pricePerSqm: payload?.pricePerSqmByBuilding ?? [],
    boqVariance: payload?.boqVarianceByBuilding ?? [],
    energyClassData,
    loading,
    error,
    refetch,
  };
}
