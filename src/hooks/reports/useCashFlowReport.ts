'use client';

/**
 * @module hooks/reports/useCashFlowReport
 * @enterprise ADR-268 Phase 8 — Cash Flow Forecast hook
 * @description Fetches cash flow projection, transforms into view models for UI.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banknote, TrendingUp, TrendingDown, AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type {
  CashFlowAPIResponse,
  CashFlowScenario,
  ScenarioProjection,
  CashFlowMonthRow,
  ActualVsForecast,
  PDCCalendarDay,
  CashFlowAlert,
  CashFlowConfig,
} from '@/services/cash-flow/cash-flow.types';
import { getErrorMessage } from '@/lib/error-utils';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level cache survives React unmount/remount (navigation)
// Keyed by filterKey (projectFilter_buildingFilter) so different filters don't collide
const cashFlowCache = createStaleCache<CashFlowAPIResponse>('report-cash-flow');

// ---------------------------------------------------------------------------
// Chart data types
// ---------------------------------------------------------------------------

export interface CashFlowChartRow {
  month: string;
  label: string;
  inflow: number;
  outflow: number;
  balance: number;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseCashFlowReportReturn {
  kpis: ReportKPI[];
  chartData: CashFlowChartRow[];
  tableRows: CashFlowMonthRow[];
  actuals: ActualVsForecast[];
  pdcCalendar: PDCCalendarDay[];
  alerts: CashFlowAlert[];
  config: CashFlowConfig | null;
  activeScenario: CashFlowScenario;
  setActiveScenario: (s: CashFlowScenario) => void;
  projectFilter: string | undefined;
  setProjectFilter: (id: string | undefined) => void;
  buildingFilter: string | undefined;
  setBuildingFilter: (id: string | undefined) => void;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCashFlowReport(): UseCashFlowReportReturn {
  const { t } = useTranslation('cash-flow');

  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [buildingFilter, setBuildingFilter] = useState<string | undefined>();

  const filterKey = useMemo(
    () => `${projectFilter ?? 'all'}_${buildingFilter ?? 'all'}`,
    [projectFilter, buildingFilter],
  );

  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [data, setData] = useState<CashFlowAPIResponse | null>(cashFlowCache.get(filterKey));
  const [loading, setLoading] = useState(!cashFlowCache.hasLoaded(filterKey));
  const [error, setError] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<CashFlowScenario>('realistic');

  const fetchData = useCallback(async (skipCache = false) => {
    // ADR-300: Only show spinner on first load for this filterKey — not on re-navigation
    if (!cashFlowCache.hasLoaded(filterKey) || skipCache) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (projectFilter) params.set('projectId', projectFilter);
      if (buildingFilter) params.set('buildingId', buildingFilter);
      params.set('months', '12');

      const qs = params.toString();
      const url = `/api/reports/cash-flow${qs ? `?${qs}` : ''}`;

      const payload = await apiClient.get<CashFlowAPIResponse>(url);

      // ADR-300: Write to module-level cache so next remount skips spinner
      cashFlowCache.set(payload, filterKey);
      setData(payload);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterKey, projectFilter, buildingFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  // Find active scenario projection
  const activeProjection = useMemo<ScenarioProjection | null>(() => {
    if (!data) return null;
    return data.scenarios.find((s) => s.scenario === activeScenario) ?? null;
  }, [data, activeScenario]);

  // Transform to chart data
  const chartData = useMemo<CashFlowChartRow[]>(() => {
    if (!activeProjection) return [];
    return activeProjection.months.map((m) => ({
      month: m.month,
      label: m.label,
      inflow: m.totalInflow,
      outflow: m.totalOutflow,
      balance: m.closingBalance,
    }));
  }, [activeProjection]);

  // Table rows
  const tableRows = useMemo<CashFlowMonthRow[]>(() => {
    return activeProjection?.months ?? [];
  }, [activeProjection]);

  // KPIs
  const kpis = useMemo<ReportKPI[]>(() => {
    if (!activeProjection) return [];
    return buildKPIs(activeProjection, t);
  }, [activeProjection, t]);

  return {
    kpis,
    chartData,
    tableRows,
    actuals: data?.actuals ?? [],
    pdcCalendar: data?.pdcCalendar ?? [],
    alerts: data?.alerts ?? [],
    config: data?.config ?? null,
    activeScenario,
    setActiveScenario,
    projectFilter,
    setProjectFilter,
    buildingFilter,
    setBuildingFilter,
    loading,
    error,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// KPI Builder
// ---------------------------------------------------------------------------

function buildKPIs(
  projection: ScenarioProjection,
  t: (key: string, params?: Record<string, string>) => string,
): ReportKPI[] {
  const lastMonth = projection.months[projection.months.length - 1];
  const firstMonth = projection.months[0];

  return [
    {
      title: t('kpi.currentBalance'),
      value: formatCurrency(firstMonth?.openingBalance ?? 0),
      icon: Banknote,
      status: (firstMonth?.openingBalance ?? 0) > 0 ? 'green' : 'red',
    },
    {
      title: t('kpi.forecastInflow'),
      value: formatCurrency(projection.totalInflow),
      icon: TrendingUp,
      status: 'green',
    },
    {
      title: t('kpi.forecastOutflow'),
      value: formatCurrency(projection.totalOutflow),
      icon: TrendingDown,
      status: 'gray',
    },
    {
      title: t('kpi.lowestBalance'),
      value: formatCurrency(projection.lowestBalance),
      description: projection.lowestBalanceMonth
        ? `${t('kpi.lowestBalanceMonth', { month: projection.lowestBalanceMonth })}`
        : undefined,
      icon: AlertTriangle,
      status: projection.lowestBalance < 0 ? 'red' : projection.lowestBalance < 10000 ? 'amber' : 'green',
    },
  ];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}
