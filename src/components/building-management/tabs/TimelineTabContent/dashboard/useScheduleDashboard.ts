'use client';

/**
 * @module useScheduleDashboard
 * @enterprise ADR-266 Phase A — Schedule Dashboard data hook
 *
 * Consumes phases/tasks from useConstructionGantt (called internally),
 * lazy-fetches BOQ items, and computes all dashboard metrics client-side.
 *
 * @see evm-calculator.ts for computeEVM / generateSCurveData
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConstructionPhase, ConstructionTask, DelayReason } from '@/types/building/construction';
import { DELAY_REASONS } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';
import type { BOQItem } from '@/types/boq';
import type { RAGStatus } from '@/components/reports/core/ReportTrafficLight';
import {
  computeEVM,
  generateSCurveData,
  getTrafficLight,
} from '@/services/report-engine/evm-calculator';
import { computeCPM } from '@/services/construction-scheduling/cpm-calculator';
import { boqService } from '@/services/measurements';
import { countBy, sumBy } from '@/utils/collection-utils';
import { useConstructionGantt } from '@/components/building-management/hooks/useConstructionGantt';
import type {
  ScheduleDashboardData,
  ScheduleVarianceRow,
  LookaheadRow,
  ScheduleKPIs,
  DelayBreakdownDataPoint,
} from './schedule-dashboard.types';

// ─── Helpers ─────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);
}

function varianceRAG(days: number): RAGStatus {
  if (days <= 0) return 'green';
  if (days <= 7) return 'amber';
  return 'red';
}

function progressRAG(actual: number, expected: number): RAGStatus {
  const delta = actual - expected;
  if (delta >= -1) return 'green';
  if (delta >= -5) return 'amber';
  return 'red';
}

function isDelayedOrBlocked(status: string): boolean {
  return status === 'delayed' || status === 'blocked';
}

/** Tally delay reasons across problematic tasks — SSoT from DELAY_REASONS */
function buildReasonCounts(
  problematicTasks: ConstructionTask[],
): Record<DelayReason | 'unspecified', number> {
  const counts = Object.fromEntries([
    ...DELAY_REASONS.map(r => [r, 0] as const),
    ['unspecified', 0] as const,
  ]) as Record<DelayReason | 'unspecified', number>;

  for (const t of problematicTasks) {
    const key: DelayReason | 'unspecified' = t.delayReason ?? 'unspecified';
    counts[key] += 1;
  }
  return counts;
}

/** Weighted average progress — weight = planned duration in days */
function weightedProgress(phases: ConstructionPhase[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const p of phases) {
    const dur = Math.max(1, daysBetween(p.plannedStartDate, p.plannedEndDate));
    weightedSum += p.progress * dur;
    totalWeight += dur;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/** Expected progress based on elapsed fraction of total project timeline */
function expectedProgress(phases: ConstructionPhase[]): number {
  if (phases.length === 0) return 0;
  const starts = phases.map(p => new Date(p.plannedStartDate).getTime());
  const ends = phases.map(p => new Date(p.plannedEndDate).getTime());
  const projectStart = Math.min(...starts);
  const projectEnd = Math.max(...ends);
  const now = Date.now();
  if (now <= projectStart) return 0;
  if (now >= projectEnd) return 100;
  return ((now - projectStart) / (projectEnd - projectStart)) * 100;
}

// ─── Variance Computation ────────────────────────────────────────────────

function buildVarianceRows(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[],
): ScheduleVarianceRow[] {
  const rows: ScheduleVarianceRow[] = [];
  const tasksByPhase = new Map<string, ConstructionTask[]>();
  for (const t of tasks) {
    const list = tasksByPhase.get(t.phaseId) ?? [];
    list.push(t);
    tasksByPhase.set(t.phaseId, list);
  }

  for (const phase of phases) {
    const phaseTasks = tasksByPhase.get(phase.id) ?? [];
    // Phase variance = worst child variance, or phase-level dates
    let variance = 0;
    if (phase.actualEndDate && phase.plannedEndDate) {
      variance = daysBetween(phase.plannedEndDate, phase.actualEndDate);
    } else if (phaseTasks.length > 0) {
      variance = Math.max(
        0,
        ...phaseTasks.map(t =>
          t.actualEndDate ? daysBetween(t.plannedEndDate, t.actualEndDate) : 0,
        ),
      );
    }

    rows.push({
      id: phase.id,
      name: phase.name,
      code: phase.code,
      type: 'phase',
      plannedStart: phase.plannedStartDate,
      plannedEnd: phase.plannedEndDate,
      actualStart: phase.actualStartDate ?? null,
      actualEnd: phase.actualEndDate ?? null,
      varianceDays: variance,
      status: phase.status,
      progress: phase.progress,
      ragStatus: varianceRAG(variance),
    });

    for (const task of phaseTasks) {
      const taskVariance = task.actualEndDate
        ? daysBetween(task.plannedEndDate, task.actualEndDate)
        : 0;

      rows.push({
        id: task.id,
        name: task.name,
        code: task.code,
        type: 'task',
        parentId: phase.id,
        plannedStart: task.plannedStartDate,
        plannedEnd: task.plannedEndDate,
        actualStart: task.actualStartDate ?? null,
        actualEnd: task.actualEndDate ?? null,
        varianceDays: taskVariance,
        status: task.status,
        progress: task.progress,
        ragStatus: varianceRAG(taskVariance),
      });
    }
  }

  // Sort by variance DESC (worst delays first)
  return rows.sort((a, b) => {
    if (a.type === 'phase' && b.type === 'phase') return b.varianceDays - a.varianceDays;
    return 0; // Keep tasks grouped under their phase
  });
}

// ─── Lookahead Computation ───────────────────────────────────────────────

function buildLookaheadRows(
  tasks: ConstructionTask[],
  phases: ConstructionPhase[],
  windowDays: number,
): LookaheadRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + windowDays);
  const cutoffMs = cutoff.getTime();

  const phaseMap = new Map(phases.map(p => [p.id, p]));

  return tasks
    .filter(t => {
      if (t.status === 'completed') return false;
      const startMs = new Date(t.plannedStartDate).getTime();
      const endMs = new Date(t.plannedEndDate).getTime();
      return startMs <= cutoffMs || endMs <= cutoffMs;
    })
    .map(t => {
      const phase = phaseMap.get(t.phaseId);
      return {
        id: t.id,
        taskName: t.name,
        phaseName: phase?.name ?? '—',
        phaseCode: phase?.code ?? '—',
        start: t.plannedStartDate,
        end: t.plannedEndDate,
        durationDays: daysBetween(t.plannedStartDate, t.plannedEndDate),
        status: t.status,
      };
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

// ─── Hook ────────────────────────────────────────────────────────────────

interface UseScheduleDashboardParams {
  companyId: string;
  buildingId: string;
  milestones: BuildingMilestone[];
}

interface UseScheduleDashboardReturn extends ScheduleDashboardData {
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  lookAheadDays: number;
  setLookAheadDays: (days: number) => void;
  refresh: () => Promise<void>;
}

export function useScheduleDashboard({
  companyId,
  buildingId,
  milestones,
}: UseScheduleDashboardParams): UseScheduleDashboardReturn {
  // Construction data (reuse same pattern as GanttView)
  const {
    phases,
    tasks,
    loading: ganttLoading,
    reload: reloadGantt,
  } = useConstructionGantt(buildingId);

  // BOQ lazy fetch
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [boqLoading, setBoqLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lookAheadDays, setLookAheadDays] = useState(14);

  useEffect(() => {
    let cancelled = false;
    setBoqLoading(true);
    boqService
      .getByBuilding(companyId, buildingId)
      .then(items => {
        if (!cancelled) {
          setBoqItems(items);
          setLastUpdated(new Date());
        }
      })
      .catch(() => {
        if (!cancelled) setBoqItems([]);
      })
      .finally(() => {
        if (!cancelled) setBoqLoading(false);
      });
    return () => { cancelled = true; };
  }, [companyId, buildingId]);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo((): ScheduleKPIs => {
    if (phases.length === 0) {
      return {
        overallProgress: 0, expectedProgress: 0,
        spi: 0, cpi: 0, daysRemaining: 0,
        phasesOnTrack: 0, totalPhases: 0,
        delayedTasks: 0, totalTasks: 0,
        criticalPathLength: 0,
      };
    }

    const evm = computeEVM(boqItems, phases, milestones);
    const progress = weightedProgress(phases);
    const expected = expectedProgress(phases);

    const ends = phases.map(p => new Date(p.plannedEndDate).getTime());
    const latestEnd = new Date(Math.max(...ends));
    const daysRem = Math.max(0, Math.ceil((latestEnd.getTime() - Date.now()) / MS_PER_DAY));

    const onTrack = countBy(phases, p => !isDelayedOrBlocked(p.status));
    const delayedCount = countBy(tasks, t => isDelayedOrBlocked(t.status));
    const cpm = computeCPM(tasks, phases);

    return {
      overallProgress: Math.round(progress * 10) / 10,
      expectedProgress: Math.round(expected * 10) / 10,
      spi: evm.spi,
      cpi: evm.cpi,
      daysRemaining: daysRem,
      phasesOnTrack: onTrack,
      totalPhases: phases.length,
      delayedTasks: delayedCount,
      totalTasks: tasks.length,
      criticalPathLength: cpm.criticalPathLength,
    };
  }, [phases, tasks, boqItems, milestones]);

  // ── S-Curve ────────────────────────────────────────────────────────────
  const sCurveData = useMemo(
    () => generateSCurveData(phases, boqItems, milestones),
    [phases, boqItems, milestones],
  );

  // ── Variance ───────────────────────────────────────────────────────────
  const varianceRows = useMemo(
    () => buildVarianceRows(phases, tasks),
    [phases, tasks],
  );

  // ── Lookahead ──────────────────────────────────────────────────────────
  const lookaheadRows = useMemo(
    () => buildLookaheadRows(tasks, phases, lookAheadDays),
    [tasks, phases, lookAheadDays],
  );

  // ── Delay Breakdown ───────────────────────────────────────────────────
  const delayBreakdownData = useMemo((): DelayBreakdownDataPoint[] => {
    const points: DelayBreakdownDataPoint[] = [];
    for (const phase of phases) {
      const phaseTasks = tasks.filter(t => t.phaseId === phase.id);
      const delayedTasks = phaseTasks.filter(t => t.status === 'delayed');
      const blockedTasks = phaseTasks.filter(t => t.status === 'blocked');
      const delayed = delayedTasks.length;
      const blocked = blockedTasks.length;
      const total = delayed + blocked;
      if (total === 0) continue;

      points.push({
        phaseId: phase.id,
        phaseName: phase.name,
        phaseCode: phase.code,
        delayed,
        blocked,
        total,
        byReason: buildReasonCounts([...delayedTasks, ...blockedTasks]),
      });
    }
    return points.sort((a, b) => b.total - a.total);
  }, [phases, tasks]);

  // ── Refresh ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await reloadGantt();
    const items = await boqService.getByBuilding(companyId, buildingId);
    setBoqItems(items);
    setLastUpdated(new Date());
  }, [companyId, buildingId, reloadGantt]);

  const loading = ganttLoading || boqLoading;

  return {
    kpis,
    sCurveData,
    varianceRows,
    lookaheadRows,
    delayBreakdownData,
    phases,
    tasks,
    loading,
    boqLoading,
    lastUpdated,
    lookAheadDays,
    setLookAheadDays,
    refresh,
  };
}
