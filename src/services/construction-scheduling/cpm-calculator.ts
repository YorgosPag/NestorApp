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
import type { CPMOptions, CPMResult, CPMTaskResult } from './cpm-types';
import { nowISO } from '@/lib/date-local';
// ADR-919 βήμα 2: η αριθμητική ημερών ζει στο `schedule-dates` (σε UTC — το παλιό τοπικό
// `setDate` έχανε μία μέρα στην αλλαγή ώρας του Μαρτίου).
import {
  addDaysUtc as addDays,
  daysBetween,
  maxDate,
  minDate,
  toIsoDay as toISO,
} from './schedule-dates';
import { activityWindowAt, plannedDurationDays } from './status-date-rule';

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
  statusDate: Date | null,
): Map<string, { es: Date; ef: Date }> {
  const results = new Map<string, { es: Date; ef: Date }>();

  for (const id of sortedIds) {
    const task = taskMap.get(id)!;
    const predFinishes = (predecessors.get(id) ?? [])
      .map(pid => results.get(pid)?.ef)
      .filter((d): d is Date => d !== undefined);
    const earliest = predFinishes.length > 0
      ? maxDate(...predFinishes)
      : new Date(task.plannedStartDate);

    if (statusDate !== null) {
      // ADR-919 βήμα 2: ημερομηνία κατάστασης — πρόοδος, πραγματικές ημερομηνίες, «όχι πριν από σήμερα».
      const { start, finish } = activityWindowAt(task, statusDate, earliest);
      results.set(id, { es: start, ef: finish });
      continue;
    }
    const duration = plannedDurationDays(task);
    results.set(id, { es: earliest, ef: addDays(earliest, duration) });
  }

  return results;
}

// ─── Backward Pass ──────────────────────────────────────────────────────

/** Compute Late Start / Late Finish for each task */
function backwardPass(
  sortedIds: string[],
  fwd: Map<string, { es: Date; ef: Date }>,
  successors: Map<string, string[]>,
  projectEnd: Date,
): Map<string, { ls: Date; lf: Date }> {
  const results = new Map<string, { ls: Date; lf: Date }>();
  const reversed = [...sortedIds].reverse();

  for (const id of reversed) {
    // Η διάρκεια του παραθύρου του forward pass: στο σχέδιο ταυτίζεται με την προγραμματισμένη,
    // στην πρόβλεψη (ADR-919) είναι η υπόλοιπη, ώστε το float να μετρά το ίδιο πράγμα.
    const { es, ef } = fwd.get(id)!;
    const duration = daysBetween(es, ef);
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

/**
 * Compute Critical Path Method for a set of construction tasks.
 *
 * Χωρίς `options.statusDate` ο υπολογισμός είναι **το σχέδιο** (ό,τι δείχνει το Gantt). Με
 * `statusDate` είναι **πρόβλεψη** (ADR-919 βήμα 2, `completion-forecast.ts`).
 */
export function computeCPM(
  tasks: ConstructionTask[],
  phases: ConstructionPhase[],
  options: CPMOptions = {},
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
  const statusDate = options.statusDate ? new Date(options.statusDate) : null;
  const fwd = forwardPass(sortedIds, taskMap, graph.predecessors, statusDate);

  // Project end = max Early Finish
  const allEFs = sortedIds.map(id => fwd.get(id)!.ef);
  const projectEnd = maxDate(...allEFs);

  // Backward pass
  const bwd = backwardPass(sortedIds, fwd, graph.successors, projectEnd);

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

type TaskIdentity = Pick<
  CPMTaskResult,
  'taskId' | 'taskName' | 'taskCode' | 'phaseId' | 'phaseName' | 'durationDays' | 'status' | 'progress'
>;

/** Τα πεδία που δεν εξαρτώνται από το CPM — κοινά για κανονικές και κυκλικές εργασίες. */
function taskIdentity(task: ConstructionTask, phase: ConstructionPhase | undefined): TaskIdentity {
  return {
    taskId: task.id,
    taskName: task.name,
    taskCode: task.code,
    phaseId: task.phaseId,
    phaseName: phase?.name ?? '—',
    durationDays: plannedDurationDays(task),
    status: task.status,
    progress: task.progress,
  };
}

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
      ...taskIdentity(task, phase),
      earlyStart: toISO(es),
      earlyFinish: toISO(ef),
      lateStart: toISO(ls),
      lateFinish: toISO(lf),
      totalFloat,
      isCritical: totalFloat === 0,
      delayImpactDays: computeDelayImpact(task, ef),
      hasCyclicDependency: false,
    });
  }

  // Add cyclic tasks as flagged entries
  for (const id of cyclicIds) {
    const task = taskMap.get(id)!;
    results.push({
      ...taskIdentity(task, phaseMap.get(task.phaseId)),
      earlyStart: task.plannedStartDate,
      earlyFinish: task.plannedEndDate,
      lateStart: task.plannedStartDate,
      lateFinish: task.plannedEndDate,
      totalFloat: 0,
      isCritical: false,
      delayImpactDays: 0,
      hasCyclicDependency: true,
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
    projectEarlyFinish: nowISO().slice(0, 10),
    cyclicTaskIds: cyclicIds,
    isValid: false,
  };
}
