'use client';

/**
 * @module hooks/reports/useConstructionReport
 * @enterprise ADR-265 Phase 11 — Construction & Timeline Report hook
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Milestone, Construction, BarChart3, TrendingUp,
  CircleDollarSign, AlertTriangle, CheckCircle, Percent,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type {
  ConstructionReportPayload,
  EVMBuildingItem,
  BOQComparisonItem,
} from '@/components/reports/sections/construction/types';
import { getErrorMessage } from '@/lib/error-utils';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL = 5 * 60 * 1000;

interface CachedData {
  payload: ConstructionReportPayload;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseConstructionReportReturn {
  kpis: ReportKPI[];
  milestonePie: { name: string; value: number }[];
  evmBuildings: EVMBuildingItem[];
  boqComparison: BOQComparisonItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Pure transforms
// ---------------------------------------------------------------------------

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildConstructionKPIs(
  data: ConstructionReportPayload,
  t: (key: string) => string,
): ReportKPI[] {
  const variancePercent = data.boqEstimatedTotal > 0
    ? Math.round((data.boqVariance / data.boqEstimatedTotal) * 100)
    : 0;

  const buildingCount = Object.keys(data.evmByBuilding).length;
  const avgCpi = buildingCount > 0
    ? +(Object.values(data.evmByBuilding).reduce((sum, e) => sum + e.cpi, 0) / buildingCount).toFixed(2)
    : 0;

  return [
    { title: t('construction.kpis.totalMilestones'), value: data.totalMilestones, icon: Milestone, color: 'blue' as const },
    { title: t('construction.kpis.completed'), value: data.completedMilestones, icon: CheckCircle, color: 'green' as const },
    { title: t('construction.kpis.phases'), value: data.phasesCount, icon: Construction, color: 'purple' as const },
    { title: t('construction.kpis.avgProgress'), value: `${data.averagePhaseProgress}%`, icon: Percent, color: 'orange' as const },
    { title: t('construction.kpis.boqEstimated'), value: formatEuro(data.boqEstimatedTotal), icon: CircleDollarSign, color: 'cyan' as const },
    { title: t('construction.kpis.boqActual'), value: formatEuro(data.boqActualTotal), icon: BarChart3, color: 'indigo' as const },
    { title: t('construction.kpis.boqVariance'), value: `${variancePercent}%`, icon: AlertTriangle, color: variancePercent > 10 ? 'red' as const : 'yellow' as const },
    { title: t('construction.kpis.avgCpi'), value: avgCpi, icon: TrendingUp, color: avgCpi >= 0.95 ? 'green' as const : 'orange' as const },
  ];
}

function buildMilestonePie(
  data: Record<string, number>,
  t: (key: string) => string,
): { name: string; value: number }[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: t(`construction.milestones.statuses.${key}`), value }));
}

function buildEVMBuildings(
  evmByBuilding: ConstructionReportPayload['evmByBuilding'],
): EVMBuildingItem[] {
  return Object.entries(evmByBuilding)
    .map(([building, evm]) => ({
      building,
      earnedValue: evm.earnedValue,
      actualCost: evm.actualCost,
      budgetAtCompletion: evm.budgetAtCompletion,
      cpi: +evm.cpi.toFixed(2),
      spi: +evm.spi.toFixed(2),
    }))
    .sort((a, b) => b.budgetAtCompletion - a.budgetAtCompletion);
}

function buildBOQComparison(
  evmByBuilding: ConstructionReportPayload['evmByBuilding'],
): BOQComparisonItem[] {
  return Object.entries(evmByBuilding)
    .map(([building, evm]) => ({
      building,
      estimated: evm.budgetAtCompletion,
      actual: evm.actualCost,
    }))
    .sort((a, b) => b.estimated - a.estimated);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useConstructionReport(): UseConstructionReportReturn {
  const { t } = useTranslation('reports');
  const cacheRef = useRef<CachedData | null>(null);
  const [payload, setPayload] = useState<ConstructionReportPayload | null>(null);
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
      const data = await apiClient.get<ConstructionReportPayload>(
        '/api/reports/construction',
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

  const kpis = useMemo(
    () => payload ? buildConstructionKPIs(payload, t) : [],
    [payload, t],
  );
  const milestonePie = useMemo(
    () => payload ? buildMilestonePie(payload.milestonesByStatus, t) : [],
    [payload, t],
  );
  const evmBuildings = useMemo(
    () => payload ? buildEVMBuildings(payload.evmByBuilding) : [],
    [payload],
  );
  const boqComparison = useMemo(
    () => payload ? buildBOQComparison(payload.evmByBuilding) : [],
    [payload],
  );

  return {
    kpis,
    milestonePie,
    evmBuildings,
    boqComparison,
    loading,
    error,
    refetch,
  };
}
