'use client';

/**
 * @module useResourceHistogram
 * @enterprise ADR-266 Phase C, Sub-phase 4 — Resource Histogram Computation
 *
 * Transforms resource assignments + task date ranges into weekly histogram data.
 * Algorithm: distribute each assignment's hours evenly across the task's weeks.
 */

import { useMemo } from 'react';
import type { ConstructionResourceAssignment, ConstructionTask } from '@/types/building/construction';
import type {
  ResourceHistogramBar,
  ResourceChartConfigEntry,
  ResourceUtilizationKPI,
  OverAllocationWarning,
} from './resource-histogram.types';

// ─── Constants ──────────────────────────────────────────────────────────

const STANDARD_WEEKLY_CAPACITY = 40;
const MS_PER_DAY = 86_400_000;
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6, 280 65% 60%))',
  'hsl(var(--chart-7, 160 60% 45%))',
  'hsl(var(--chart-8, 30 80% 55%))',
];

// ─── Helpers ────────────────────────────────────────────────────────────

/** Get Monday of the week containing a date */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format week label: "W13 - 24 Mar" */
function formatWeekLabel(monday: Date): string {
  const weekNum = getISOWeek(monday);
  const month = monday.toLocaleDateString('en', { month: 'short' });
  return `W${weekNum} - ${monday.getDate()} ${month}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / MS_PER_DAY + yearStart.getDay() + 1) / 7);
}

/** Count working weeks spanned by a date range (at least 1) */
function countWeeks(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
  return Math.max(1, Math.ceil(days / 7));
}

/** Generate all Mondays between two dates */
function generateWeekMondays(startDate: Date, endDate: Date): Date[] {
  const mondays: Date[] = [];
  const current = getWeekMonday(startDate);
  const lastMonday = getWeekMonday(endDate);
  while (current <= lastMonday) {
    mondays.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  return mondays;
}

// ─── Hook ───────────────────────────────────────────────────────────────

interface UseResourceHistogramInput {
  assignments: ConstructionResourceAssignment[];
  tasks: ConstructionTask[];
}

interface UseResourceHistogramReturn {
  histogramData: ResourceHistogramBar[];
  chartConfig: Record<string, ResourceChartConfigEntry>;
  resourceNames: string[];
  utilization: ResourceUtilizationKPI;
  overAllocations: OverAllocationWarning[];
  hasData: boolean;
}

export function useResourceHistogram({
  assignments,
  tasks,
}: UseResourceHistogramInput): UseResourceHistogramReturn {
  return useMemo(() => {
    if (assignments.length === 0) {
      return {
        histogramData: [],
        chartConfig: {},
        resourceNames: [],
        utilization: { totalResources: 0, avgUtilization: 0, overAllocatedCount: 0, peakWeek: '', peakHours: 0 },
        overAllocations: [],
        hasData: false,
      };
    }

    // Build task lookup
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Unique resource names
    const resourceNameSet = new Set<string>();
    assignments.forEach(a => resourceNameSet.add(a.resourceName));
    const resourceNames = Array.from(resourceNameSet).sort();

    // Determine date range from tasks referenced by assignments
    let minDate = Infinity;
    let maxDate = -Infinity;
    for (const a of assignments) {
      const task = taskMap.get(a.taskId);
      if (!task) continue;
      const start = new Date(task.plannedStartDate).getTime();
      const end = new Date(task.plannedEndDate).getTime();
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
    }

    if (minDate === Infinity) {
      return {
        histogramData: [],
        chartConfig: {},
        resourceNames: [],
        utilization: { totalResources: 0, avgUtilization: 0, overAllocatedCount: 0, peakWeek: '', peakHours: 0 },
        overAllocations: [],
        hasData: false,
      };
    }

    // Generate week buckets
    const mondays = generateWeekMondays(new Date(minDate), new Date(maxDate));

    // weekKey → { resourceName → hours }
    const weekMap = new Map<string, Record<string, number>>();
    for (const monday of mondays) {
      const key = monday.toISOString().slice(0, 10);
      const bucket: Record<string, number> = {};
      resourceNames.forEach(name => { bucket[name] = 0; });
      weekMap.set(key, bucket);
    }

    // Distribute each assignment's hours across its task's weeks
    for (const a of assignments) {
      const task = taskMap.get(a.taskId);
      if (!task) continue;

      const taskWeeks = countWeeks(task.plannedStartDate, task.plannedEndDate);
      const hoursPerWeek = a.allocatedHours / taskWeeks;

      const taskStart = new Date(task.plannedStartDate);
      const taskEnd = new Date(task.plannedEndDate);
      const taskMondays = generateWeekMondays(taskStart, taskEnd);

      for (const monday of taskMondays) {
        const key = monday.toISOString().slice(0, 10);
        const bucket = weekMap.get(key);
        if (bucket) {
          bucket[a.resourceName] = (bucket[a.resourceName] ?? 0) + hoursPerWeek;
        }
      }
    }

    // Build histogram bars
    const histogramData: ResourceHistogramBar[] = mondays.map(monday => {
      const key = monday.toISOString().slice(0, 10);
      const bucket = weekMap.get(key) ?? {};
      const bar: ResourceHistogramBar = {
        weekLabel: formatWeekLabel(monday),
        weekStart: key,
      };
      resourceNames.forEach(name => {
        bar[name] = Math.round((bucket[name] ?? 0) * 10) / 10;
      });
      return bar;
    });

    // Build chart config (colors)
    const chartConfig: Record<string, ResourceChartConfigEntry> = {};
    resourceNames.forEach((name, i) => {
      chartConfig[name] = {
        label: name,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });

    // Detect over-allocations
    const overAllocations: OverAllocationWarning[] = [];
    const overAllocatedResources = new Set<string>();

    for (const bar of histogramData) {
      for (const name of resourceNames) {
        const hours = bar[name] as number;
        if (hours > STANDARD_WEEKLY_CAPACITY) {
          overAllocations.push({
            resourceName: name,
            weekLabel: bar.weekLabel,
            hours,
          });
          overAllocatedResources.add(name);
        }
      }
    }

    // Compute utilization KPIs
    let totalHoursAll = 0;
    let totalWeeksAll = 0;
    let peakHours = 0;
    let peakWeek = '';

    for (const bar of histogramData) {
      let weekTotal = 0;
      for (const name of resourceNames) {
        const h = bar[name] as number;
        totalHoursAll += h;
        totalWeeksAll++;
        weekTotal += h;
      }
      if (weekTotal > peakHours) {
        peakHours = weekTotal;
        peakWeek = bar.weekLabel;
      }
    }

    const avgUtilization = totalWeeksAll > 0
      ? Math.round((totalHoursAll / (totalWeeksAll * STANDARD_WEEKLY_CAPACITY)) * 100)
      : 0;

    const utilization: ResourceUtilizationKPI = {
      totalResources: resourceNames.length,
      avgUtilization,
      overAllocatedCount: overAllocatedResources.size,
      peakWeek,
      peakHours: Math.round(peakHours * 10) / 10,
    };

    return { histogramData, chartConfig, resourceNames, utilization, overAllocations, hasData: true };
  }, [assignments, tasks]);
}
