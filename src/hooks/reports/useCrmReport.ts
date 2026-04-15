'use client';

/**
 * @module hooks/reports/useCrmReport
 * @enterprise ADR-265 Phase 8 — CRM & Pipeline Report hook
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Target, Trophy, Percent, DollarSign,
  ListTodo, AlertTriangle, MessageSquare, Users,
} from 'lucide-react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ReportKPI } from '@/components/reports/core';
import type {
  CrmReportPayload,
  PipelineStageItem,
  ChannelItem,
  SourceItem,
} from '@/components/reports/sections/crm/types';
import { getErrorMessage } from '@/lib/error-utils';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const crmReportCache = createStaleCache<CrmReportPayload>('report-crm');

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseCrmReportReturn {
  kpis: ReportKPI[];
  pipelineStages: PipelineStageItem[];
  taskStatusPie: { name: string; value: number }[];
  taskPriorityPie: { name: string; value: number }[];
  channelBars: ChannelItem[];
  leadSourcePie: SourceItem[];
  teamBars: { assignee: string; tasks: number }[];
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

function buildCrmKPIs(
  data: CrmReportPayload,
  t: (key: string) => string,
): ReportKPI[] {
  return [
    { title: t('crm.kpis.opportunities'), value: data.totalOpportunities, icon: Target, color: 'blue' as const },
    { title: t('crm.kpis.wonDeals'), value: data.wonCount, icon: Trophy, color: 'green' as const },
    { title: t('crm.kpis.winRate'), value: `${data.winRate}%`, icon: Percent, color: 'cyan' as const },
    { title: t('crm.kpis.avgDeal'), value: formatEuro(data.avgDealValue), icon: DollarSign, color: 'purple' as const },
    { title: t('crm.kpis.totalTasks'), value: data.totalTasks, icon: ListTodo, color: 'indigo' as const },
    { title: t('crm.kpis.overdueTasks'), value: data.overdueTasks, icon: AlertTriangle, color: 'red' as const },
    { title: t('crm.kpis.communications'), value: data.totalCommunications, icon: MessageSquare, color: 'orange' as const },
    { title: t('crm.kpis.lostDeals'), value: data.lostCount, icon: Users, color: 'yellow' as const },
  ];
}

function buildPipelineStages(
  byStage: Record<string, number>,
  valueByStage: Record<string, number>,
  t: (key: string) => string,
): PipelineStageItem[] {
  return Object.entries(byStage).map(([stage, count]) => ({
    stage: t(`crm.stages.${stage}`),
    count,
    value: valueByStage[stage] ?? 0,
  }));
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

function buildChannelBars(
  data: Record<string, number>,
  t: (key: string) => string,
): ChannelItem[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([channel, count]) => ({
      channel: t(`crm.channels.${channel}`),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildTeamBars(
  data: Record<string, number>,
): { assignee: string; tasks: number }[] {
  return Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([assignee, tasks]) => ({ assignee, tasks }))
    .sort((a, b) => b.tasks - a.tasks)
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useCrmReport(): UseCrmReportReturn {
  const { t } = useTranslation('reports');
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [payload, setPayload] = useState<CrmReportPayload | null>(crmReportCache.get());
  const [loading, setLoading] = useState(!crmReportCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (force = false) => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!crmReportCache.hasLoaded() || force) setLoading(true);
    setError(null);

    try {
      const data = await apiClient.get<CrmReportPayload>(
        '/api/reports/crm',
      );
      // ADR-300: Write to module-level cache so next remount skips spinner
      crmReportCache.set(data);
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
    () => payload ? buildCrmKPIs(payload, t) : [],
    [payload, t],
  );
  const pipelineStages = useMemo(
    () => payload ? buildPipelineStages(payload.pipelineByStage, payload.pipelineValueByStage, t) : [],
    [payload, t],
  );
  const taskStatusPie = useMemo(
    () => payload ? buildRecordPie(payload.tasksByStatus, 'crm.taskStatuses', t) : [],
    [payload, t],
  );
  const taskPriorityPie = useMemo(
    () => payload ? buildRecordPie(payload.tasksByPriority, 'crm.priorities', t) : [],
    [payload, t],
  );
  const channelBars = useMemo(
    () => payload ? buildChannelBars(payload.communicationsByChannel, t) : [],
    [payload, t],
  );
  const leadSourcePie = useMemo(
    () => payload ? buildRecordPie(payload.leadsBySource, 'crm.sources', t) : [],
    [payload, t],
  );
  const teamBars = useMemo(
    () => payload ? buildTeamBars(payload.tasksByAssignee) : [],
    [payload],
  );

  return {
    kpis,
    pipelineStages,
    taskStatusPie,
    taskPriorityPie,
    channelBars,
    leadSourcePie,
    teamBars,
    loading,
    error,
    refetch,
  };
}
