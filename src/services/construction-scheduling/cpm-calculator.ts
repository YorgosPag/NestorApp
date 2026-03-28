/**
 * @module cpm-calculator
 * @enterprise ADR-266 Phase C Sub-phase 2 — Critical Path Method
 *
 * Pure-function CPM calculator: forward/backward pass, cycle detection,
 * float computation. No side effects, no API calls.
 *
 * @see cpm-types.ts for result interfaces
 */

import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { CPMResult, CPMTaskResult } from './cpm-types';

// ─── Constants ──────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

// ─── Date Helpers ───────────────────────────────────────────────────────

function daysBetween(a: string | Date, b: string | Date): number {
  const ta = typeof a === 'string' ? new Date(a).getTime() : a.getTime();
  const tb = typeof b === 'string' ? new Date(b).getTime() : b.getTime();
  return Math.round((tb - ta) / MS_PER_DAY);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map(d => d.getTime())));
}

function minDate(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map(d => d.getTime())));
}

// ─── Graph Construction ─────────────────────────────────────────────────

interface AdjacencyGraph {
  predecessors: Map<string, string[]>;
  successors: Map<string, string[]>;
}

/** Build predecessor/successor maps from task.dependencies[] */
function buildAdjacencyGraph(
  tasks: ConstructionTask[],
): AdjacencyGraph {
  const taskIds = new Set(tasks.map(t => t.id));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();

  for (const task of tasks) {
    predecessors.set(task.id, []);
    successors.set(task.id, []);
  }

  for (const task of tasks) {
    const deps = task.dependencies ?? [];
    for (const depId of deps) {
      if (!taskIds.has(depId)) continue; // skip invalid refs
      predecessors.get(task.id)!.push(depId);
      successors.get(depId)!.push(task.id);
    }
  }

  return { predecessors, successors };
}

// ─── Cycle Detection (Kahn's Algorithm) ─────────────────────────────────

interface TopologicalResult {
  sortedIds: string[];
  cyclicIds: string[];
}

/** Kahn's algorithm: topological sort + cycle detection */
function topologicalSort(
  taskIds: string[],
  predecessors: Map<string, string[]>,
  successors: Map<string, string[]>,
): TopologicalResult {
  const inDegree = new Map<string, number>();
  for (const id of taskIds) {
    inDegree.set(id, predecessors.get(id)?.length ?? 0);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const succ of successors.get(current) ?? []) {
      const newDeg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, newDeg);
      if (newDeg === 0) queue.push(succ);
    }
  }

  const cyclicIds = taskIds.filter(id => !sorted.includes(id));
  return { sortedIds: sorted, cyclicIds };
}

// ─── Forward Pass ───────────────────────────────────────────────────────

/** Compute Early Start / Early Finish for each task */
function forwardPass(
  sortedIds: string[],
  taskMap: Map<string, ConstructionTask>,
  predecessors: Map<string, string[]>,
): Map<string, { es: Date; ef: Date }> {
  const results = new Map<string, { es: Date; ef: Date }>();

  for (const id of sortedIds) {
    const task = taskMap.get(id)!;
    const duration = Math.max(1, daysBetween(task.plannedStartDate, task.plannedEndDate));
    const preds = predecessors.get(id) ?? [];

    let es: Date;
    if (preds.length === 0) {
      es = new Date(task.plannedStartDate);
    } else {
      const predFinishes = preds
        .map(pid => results.get(pid)?.ef)
        .filter((d): d is Date => d !== undefined);
      es = predFinishes.length > 0
        ? maxDate(...predFinishes)
        : new Date(task.plannedStartDate);
    }

    const ef = addDays(es, duration);
    results.set(id, { es, ef });
  }

  return results;
}

// ─── Backward Pass ──────────────────────────────────────────────────────

/** Compute Late Start / Late Finish for each task */
function backwardPass(
  sortedIds: string[],
  taskMap: Map<string, ConstructionTask>,
  successors: Map<string, string[]>,
  projectEnd: Date,
): Map<string, { ls: Date; lf: Date }> {
  const results = new Map<string, { ls: Date; lf: Date }>();
  const reversed = [...sortedIds].reverse();

  for (const id of reversed) {
    const task = taskMap.get(id)!;
    const duration = Math.max(1, daysBetween(task.plannedStartDate, task.plannedEndDate));
    const succs = successors.get(id) ?? [];

    let lf: Date;
    if (succs.length === 0) {
      lf = projectEnd;
    } else {
      const succStarts = succs
        .map(sid => results.get(sid)?.ls)
        .filter((d): d is Date => d !== undefined);
      lf = succStarts.length > 0
        ? minDate(...succStarts)
        : projectEnd;
    }

    const ls = addDays(lf, -duration);
    results.set(id, { ls, lf });
  }

  return results;
}

// ─── Delay Impact ───────────────────────────────────────────────────────

/** How many days a task exceeds its Early Finish (based on actual dates) */
function computeDelayImpact(
  task: ConstructionTask,
  ef: Date,
): number {
  if (task.status === 'completed' && task.actualEndDate) {
    return Math.max(0, daysBetween(ef, new Date(task.actualEndDate)));
  }
  if (task.status === 'delayed' || task.status === 'blocked') {
    return Math.max(0, daysBetween(ef, new Date()));
  }
  return 0;
}

// ─── Main Entry Point ───────────────────────────────────────────────────

/** Compute Critical Path Method for a set of construction tasks */
export function computeCPM(
  tasks: ConstructionTask[],
  phases: ConstructionPhase[],
): CPMResult {
  if (tasks.length === 0) {
    return emptyResult();
  }

  const phaseMap = new Map(phases.map(p => [p.id, p]));
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const graph = buildAdjacencyGraph(tasks);

  // Topological sort + cycle detection
  const { sortedIds, cyclicIds } = topologicalSort(
    tasks.map(t => t.id),
    graph.predecessors,
    graph.successors,
  );

  if (sortedIds.length === 0) {
    return emptyResult(cyclicIds);
  }

  // Forward pass
  const fwd = forwardPass(sortedIds, taskMap, graph.predecessors);

  // Project end = max Early Finish
  const allEFs = sortedIds.map(id => fwd.get(id)!.ef);
  const projectEnd = maxDate(...allEFs);

  // Backward pass
  const bwd = backwardPass(sortedIds, taskMap, graph.successors, projectEnd);

  // Assemble results
  const cpmTasks = assembleResults(
    sortedIds, cyclicIds, taskMap, phaseMap, fwd, bwd,
  );

  const criticalPath = cpmTasks
    .filter(t => t.isCritical && !t.hasCyclicDependency)
    .sort((a, b) => new Date(a.earlyStart).getTime() - new Date(b.earlyStart).getTime());

  const criticalPathLength = criticalPath.length > 0
    ? daysBetween(criticalPath[0].earlyStart, criticalPath[criticalPath.length - 1].earlyFinish)
    : 0;

  return {
    tasks: cpmTasks,
    criticalPath,
    criticalPathLength,
    projectEarlyFinish: toISO(projectEnd),
    cyclicTaskIds: cyclicIds,
    isValid: true,
  };
}

// ─── Assemble Results ───────────────────────────────────────────────────

function assembleResults(
  sortedIds: string[],
  cyclicIds: string[],
  taskMap: Map<string, ConstructionTask>,
  phaseMap: Map<string, ConstructionPhase>,
  fwd: Map<string, { es: Date; ef: Date }>,
  bwd: Map<string, { ls: Date; lf: Date }>,
): CPMTaskResult[] {
  const results: CPMTaskResult[] = [];

  for (const id of sortedIds) {
    const task = taskMap.get(id)!;
    const phase = phaseMap.get(task.phaseId);
    const { es, ef } = fwd.get(id)!;
    const { ls, lf } = bwd.get(id)!;
    const totalFloat = Math.max(0, daysBetween(es, ls));

    results.push({
      taskId: task.id,
      taskName: task.name,
      taskCode: task.code,
      phaseId: task.phaseId,
      phaseName: phase?.name ?? '—',
      durationDays: Math.max(1, daysBetween(task.plannedStartDate, task.plannedEndDate)),
      earlyStart: toISO(es),
      earlyFinish: toISO(ef),
      lateStart: toISO(ls),
      lateFinish: toISO(lf),
      totalFloat,
      isCritical: totalFloat === 0,
      delayImpactDays: computeDelayImpact(task, ef),
      hasCyclicDependency: false,
      status: task.status,
      progress: task.progress,
    });
  }

  // Add cyclic tasks as flagged entries
  for (const id of cyclicIds) {
    const task = taskMap.get(id)!;
    const phase = phaseMap.get(task.phaseId);
    results.push({
      taskId: task.id,
      taskName: task.name,
      taskCode: task.code,
      phaseId: task.phaseId,
      phaseName: phase?.name ?? '—',
      durationDays: Math.max(1, daysBetween(task.plannedStartDate, task.plannedEndDate)),
      earlyStart: task.plannedStartDate,
      earlyFinish: task.plannedEndDate,
      lateStart: task.plannedStartDate,
      lateFinish: task.plannedEndDate,
      totalFloat: 0,
      isCritical: false,
      delayImpactDays: 0,
      hasCyclicDependency: true,
      status: task.status,
      progress: task.progress,
    });
  }

  return results;
}

// ─── Empty Result ───────────────────────────────────────────────────────

function emptyResult(cyclicIds: string[] = []): CPMResult {
  return {
    tasks: [],
    criticalPath: [],
    criticalPathLength: 0,
    projectEarlyFinish: new Date().toISOString().slice(0, 10),
    cyclicTaskIds: cyclicIds,
    isValid: false,
  };
}
