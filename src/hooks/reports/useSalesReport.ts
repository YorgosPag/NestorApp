'use client';

/**
 * @module hooks/reports/useSalesReport
 * @enterprise ADR-265 Phase 6 — Sales & Collections Report hook
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wallet, TrendingUp, ShoppingCart, Home,
  Percent, CreditCard, AlertTriangle, Clock,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type { FunnelStage } from '@/components/reports/core';
import type { SalesReportPayload } from '@/components/reports/sections/sales/types';
import type { AgingBucketResult } from '@/services/report-engine';
import { getErrorMessage } from '@/lib/error-utils';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL = 5 * 60 * 1000;

interface CachedData {
  payload: SalesReportPayload;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseSalesReportReturn {
  kpis: ReportKPI[];
  paymentPie: { name: string; value: number }[];
  chequesPie: { name: string; value: number }[];
  legalBars: { phase: string; count: number }[];
  funnelStages: FunnelStage[];
  agingBuckets: AgingBucketResult[];
  totalRevenue: number;
  pipelineValue: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Pure transforms (<40 lines each)
// ---------------------------------------------------------------------------

function buildKPIs(
  data: SalesReportPayload,
  t: (key: string) => string,
): ReportKPI[] {
  return [
    {
      title: t('sales.kpis.totalRevenue'),
      value: formatEuro(data.totalRevenue),
      icon: Wallet, color: 'green' as const,
    },
    {
      title: t('sales.kpis.pipelineValue'),
      value: formatEuro(data.pipelineValue),
      icon: TrendingUp, color: 'blue' as const,
    },
    {
      title: t('sales.kpis.soldProperties'),
      value: data.soldProperties,
      icon: ShoppingCart, color: 'purple' as const,
    },
    {
      title: t('sales.kpis.forSaleProperties'),
      value: data.forSaleProperties,
      icon: Home, color: 'indigo' as const,
    },
    {
      title: t('sales.kpis.conversionRate'),
      value: `${data.conversionRate}%`,
      icon: Percent, color: 'cyan' as const,
    },
    {
      title: t('sales.kpis.paymentCoverage'),
      value: `${data.averagePaymentCoverage}%`,
      icon: CreditCard, color: 'orange' as const,
    },
    {
      title: t('sales.kpis.overdueInstallments'),
      value: data.totalOverdueInstallments,
      icon: AlertTriangle, color: 'red' as const,
    },
    {
      title: t('sales.kpis.outstanding'),
      value: formatEuro(data.totalOutstanding),
      icon: Clock, color: 'yellow' as const,
    },
  ];
}

function buildPaymentPie(
  data: SalesReportPayload,
  t: (key: string) => string,
): { name: string; value: number }[] {
  const paid = data.totalRevenue - data.totalOutstanding;
  if (data.totalRevenue === 0) return [];
  return [
    { name: t('sales.payment.paid'), value: Math.max(0, paid) },
    { name: t('sales.payment.outstanding'), value: data.totalOutstanding },
  ];
}

function buildChequesPie(
  cheques: Record<string, number>,
  t: (key: string) => string,
): { name: string; value: number }[] {
  return Object.entries(cheques)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: t(`sales.cheques.statuses.${status}`),
      value: count,
    }));
}

function buildLegalBars(
  phases: Record<string, number>,
  t: (key: string) => string,
): { phase: string; count: number }[] {
  return Object.entries(phases)
    .filter(([, count]) => count > 0)
    .map(([phase, count]) => ({
      phase: t(`sales.legal.phases.${phase}`),
      count,
    }));
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

export function useSalesReport(): UseSalesReportReturn {
  const { t } = useTranslation('reports');
  const cacheRef = useRef<CachedData | null>(null);
  const [payload, setPayload] = useState<SalesReportPayload | null>(null);
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
      const data = await apiClient.get<SalesReportPayload>(
        '/api/reports/sales',
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
    () => payload ? buildKPIs(payload, t) : [],
    [payload, t],
  );
  const paymentPie = useMemo(
    () => payload ? buildPaymentPie(payload, t) : [],
    [payload, t],
  );
  const chequesPie = useMemo(
    () => payload ? buildChequesPie(payload.chequesByStatus, t) : [],
    [payload, t],
  );
  const legalBars = useMemo(
    () => payload ? buildLegalBars(payload.legalPhases, t) : [],
    [payload, t],
  );

  // Funnel: use sold + forSale as simple conversion stages
  const funnelStages = useMemo<FunnelStage[]>(() => {
    if (!payload) return [];
    const total = payload.soldProperties + payload.forSaleProperties;
    if (total === 0) return [];
    return [
      { name: t('sales.funnel.total'), value: total },
      { name: t('sales.funnel.forSale'), value: payload.forSaleProperties },
      { name: t('sales.funnel.sold'), value: payload.soldProperties },
    ];
  }, [payload, t]);

  return {
    kpis,
    paymentPie,
    chequesPie,
    legalBars,
    funnelStages,
    agingBuckets: payload?.agingBuckets ?? [],
    totalRevenue: payload?.totalRevenue ?? 0,
    pipelineValue: payload?.pipelineValue ?? 0,
    loading,
    error,
    refetch,
  };
}
