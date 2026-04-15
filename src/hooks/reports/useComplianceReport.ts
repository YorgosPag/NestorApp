'use client';

/**
 * @module hooks/reports/useComplianceReport
 * @enterprise ADR-265 Phase 12 — Compliance & Labor Report hook
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, Clock, Timer, Stamp,
  Percent, ScanLine,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type { ComplianceReportPayload } from '@/components/reports/sections/compliance/types';
import { getErrorMessage } from '@/lib/error-utils';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const complianceReportCache = createStaleCache<ComplianceReportPayload>('report-compliance');

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseComplianceReportReturn {
  kpis: ReportKPI[];
  methodPie: { name: string; value: number }[];
  insuranceBars: { name: string; value: number }[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// Pure transforms
// ---------------------------------------------------------------------------

function buildComplianceKPIs(
  data: ComplianceReportPayload,
  t: (key: string) => string,
): ReportKPI[] {
  return [
    { title: t('compliance.kpis.totalWorkers'), value: data.totalWorkers, icon: Users, color: 'blue' as const },
    { title: t('compliance.kpis.hoursLogged'), value: data.totalHoursLogged.toLocaleString('el-GR'), icon: Clock, color: 'green' as const },
    { title: t('compliance.kpis.overtime'), value: data.totalOvertimeHours.toLocaleString('el-GR'), icon: Timer, color: 'orange' as const },
    { title: t('compliance.kpis.stamps'), value: data.totalStamps.toLocaleString('el-GR'), icon: Stamp, color: 'purple' as const },
    { title: t('compliance.kpis.attendanceRate'), value: `${data.attendanceRate}%`, icon: Percent, color: 'cyan' as const },
    { title: t('compliance.kpis.checkInMethods'), value: Object.keys(data.checkInsByMethod).length, icon: ScanLine, color: 'indigo' as const },
  ];
}

function buildRecordPie(
  data: Record<string, number>,
  ns: string,
  t: (key: string) => string,
): { name: string; value: number }[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: t(`${ns}.${key}`), value }));
}

function buildInsuranceBars(
  data: Record<string, number>,
  t: (key: string) => string,
): { name: string; value: number }[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([classNum, count]) => ({
      name: `${t('compliance.insurance.classLabel')} ${classNum}`,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useComplianceReport(): UseComplianceReportReturn {
  const { t } = useTranslation('reports');
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [payload, setPayload] = useState<ComplianceReportPayload | null>(complianceReportCache.get());
  const [loading, setLoading] = useState(!complianceReportCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!complianceReportCache.hasLoaded() || force) setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<ComplianceReportPayload>(
        '/api/reports/compliance',
      );
      // ADR-300: Write to module-level cache so next remount skips spinner
      complianceReportCache.set(data);
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
    () => payload ? buildComplianceKPIs(payload, t) : [],
    [payload, t],
  );
  const methodPie = useMemo(
    () => payload ? buildRecordPie(payload.checkInsByMethod, 'compliance.methods', t) : [],
    [payload, t],
  );
  const insuranceBars = useMemo(
    () => payload ? buildInsuranceBars(payload.workersByInsuranceClass, t) : [],
    [payload, t],
  );

  return {
    kpis,
    methodPie,
    insuranceBars,
    loading,
    error,
    refetch,
  };
}
