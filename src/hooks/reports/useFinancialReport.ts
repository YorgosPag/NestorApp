'use client';

/**
 * @module hooks/reports/useFinancialReport
 * @enterprise ADR-265 Phase 5 — Financial Report hook
 *
 * Fetches financial data from /api/reports/financial and transforms
 * into chart-ready view models. 5-min in-memory cache (ADR 12.23).
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet, Calculator, TrendingDown, TrendingUp,
  BarChart3, Target,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type { EVMResult, SCurveDataPoint, AgingBucketResult } from '@/services/report-engine';
import type { FinancialReportData, ConstructionReportData } from '@/services/report-engine';
import type {
  FinancialReportPayload,
  CostVarianceItem,
  RevenueByBuilding,
} from '@/components/reports/sections/financial/types';
import { getErrorMessage } from '@/lib/error-utils';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// API response shape (before flatten)
interface ApiFinancialResponse {
  financial: FinancialReportData;
  construction: ConstructionReportData;
  buildingNames: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Cache (ADR-300: module-level stale-while-revalidate)
// ---------------------------------------------------------------------------

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const financialReportCache = createStaleCache<FinancialReportPayload>('report-financial');

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseFinancialReportReturn {
  portfolioEVM: EVMResult | null;
  evmKPIs: ReportKPI[];
  sCurveData: SCurveDataPoint[];
  costVariance: CostVarianceItem[];
  revenueByProject: RevenueByBuilding[];
  totalReceivables: number;
  totalCollected: number;
  collectionRate: number;
  agingBuckets: AgingBucketResult[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Pure transform functions (each <40 lines)
// ---------------------------------------------------------------------------

function buildEVMKPIs(
  evm: EVMResult | null,
  t: (key: string) => string,
): ReportKPI[] {
  if (!evm) return [];

  return [
    {
      title: t('financial.evm.bac'),
      value: formatEuro(evm.budgetAtCompletion),
      icon: Wallet,
      color: 'blue' as const,
    },
    {
      title: t('financial.evm.eac'),
      value: formatEuro(evm.estimateAtCompletion),
      icon: Calculator,
      color: 'purple' as const,
    },
    {
      title: t('financial.evm.cv'),
      value: formatEuro(evm.costVariance),
      icon: evm.costVariance >= 0 ? TrendingUp : TrendingDown,
      color: evm.costVariance >= 0 ? 'green' as const : 'red' as const,
    },
    {
      title: t('financial.evm.sv'),
      value: formatEuro(evm.scheduleVariance),
      icon: evm.scheduleVariance >= 0 ? TrendingUp : TrendingDown,
      color: evm.scheduleVariance >= 0 ? 'green' as const : 'red' as const,
    },
    {
      title: t('financial.evm.cpi'),
      value: evm.cpi.toFixed(2),
      icon: BarChart3,
      color: 'cyan' as const,
      status: evm.cpiHealth,
    },
    {
      title: t('financial.evm.spi'),
      value: evm.spi.toFixed(2),
      icon: Target,
      color: 'orange' as const,
      status: evm.spiHealth,
    },
  ];
}

function buildCostVariance(
  evmByBuilding: Record<string, EVMResult>,
  buildingNames: Record<string, string>,
): CostVarianceItem[] {
  return Object.entries(evmByBuilding).map(([id, evm]) => ({
    building: buildingNames[id] || id,
    estimated: evm.budgetAtCompletion,
    actual: evm.actualCost,
    variance: evm.costVariance,
  }));
}

function buildRevenueByBuilding(
  evmByBuilding: Record<string, EVMResult>,
  buildingNames: Record<string, string>,
): RevenueByBuilding[] {
  return Object.entries(evmByBuilding)
    .map(([id, evm]) => ({
      building: buildingNames[id] || id,
      earnedValue: evm.earnedValue,
    }))
    .sort((a, b) => b.earnedValue - a.earnedValue);
}

function mergeSCurveData(
  evmByBuilding: Record<string, EVMResult>,
): SCurveDataPoint[] {
  const monthMap = new Map<string, SCurveDataPoint>();

  for (const evm of Object.values(evmByBuilding)) {
    for (const pt of evm.sCurveData) {
      const existing = monthMap.get(pt.date);
      if (existing) {
        existing.plannedValue += pt.plannedValue;
        existing.earnedValue += pt.earnedValue;
        existing.actualCost += pt.actualCost;
      } else {
        monthMap.set(pt.date, { ...pt });
      }
    }
  }

  return Array.from(monthMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date),
  );
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useFinancialReport(): UseFinancialReportReturn {
  const { t } = useTranslation('reports');
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [payload, setPayload] = useState<FinancialReportPayload | null>(financialReportCache.get());
  const [loading, setLoading] = useState(!financialReportCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!financialReportCache.hasLoaded() || force) setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<ApiFinancialResponse>(
        '/api/reports/financial',
      );

      const merged: FinancialReportPayload = {
        totalReceivables: response.financial.totalReceivables,
        totalCollected: response.financial.totalCollected,
        collectionRate: response.financial.collectionRate,
        agingBuckets: response.financial.agingBuckets,
        portfolioEVM: response.financial.portfolioEVM,
        evmByBuilding: response.construction.evmByBuilding,
        buildingNames: response.buildingNames,
        boqEstimatedTotal: response.construction.boqEstimatedTotal,
        boqActualTotal: response.construction.boqActualTotal,
        boqVariance: response.construction.boqVariance,
        generatedAt: response.financial.generatedAt,
      };

      // ADR-300: Write to module-level cache so next remount skips spinner
      financialReportCache.set(merged);
      setPayload(merged);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  // Derive view-models
  const portfolioEVM = payload?.portfolioEVM ?? null;
  const evmKPIs = buildEVMKPIs(portfolioEVM, t);
  const sCurveData = payload
    ? mergeSCurveData(payload.evmByBuilding)
    : [];
  const costVariance = payload
    ? buildCostVariance(payload.evmByBuilding, payload.buildingNames)
    : [];
  const revenueByProject = payload
    ? buildRevenueByBuilding(payload.evmByBuilding, payload.buildingNames)
    : [];

  return {
    portfolioEVM,
    evmKPIs,
    sCurveData,
    costVariance,
    revenueByProject,
    totalReceivables: payload?.totalReceivables ?? 0,
    totalCollected: payload?.totalCollected ?? 0,
    collectionRate: payload?.collectionRate ?? 0,
    agingBuckets: payload?.agingBuckets ?? [],
    loading,
    error,
    refetch,
  };
}
