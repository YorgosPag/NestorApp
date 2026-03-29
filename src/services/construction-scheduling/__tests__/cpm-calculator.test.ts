/* eslint-disable no-restricted-syntax */
/**
 * =============================================================================
 * CPM Calculator — Unit Tests (ADR-266)
 * =============================================================================
 *
 * Pure-function tests for Critical Path Method algorithm.
 * Covers: forward/backward pass, cycle detection, critical path,
 *         empty input, single task, linear chain, diamond DAG, delay impact.
 *
 * @module tests/construction-scheduling/cpm-calculator
 * @see ADR-266 Phase C Sub-phase 2 (Critical Path Method)
 */

import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import { computeCPM } from '../cpm-calculator';

// ─── Test Data Factories ───────────────────────────────────────────────

function makeTask(overrides: Partial<ConstructionTask> = {}): ConstructionTask {
  return {
    id: 'task_1',
    phaseId: 'phase_1',
    buildingId: 'bld_1',
    companyId: 'comp_1',
    name: 'Task 1',
    code: 'T1',
    order: 1,
    status: 'not_started',
    progress: 0,
    plannedStartDate: '2026-01-01',
    plannedEndDate: '2026-01-11', // 10 days
    actualStartDate: null,
    actualEndDate: null,
    dependencies: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ConstructionTask;
}

function makePhase(overrides: Partial<ConstructionPhase> = {}): ConstructionPhase {
  return {
    id: 'phase_1',
    buildingId: 'bld_1',
    companyId: 'comp_1',
    name: 'Phase 1',
    code: 'P1',
    order: 1,
    status: 'in_progress',
    progress: 0,
    plannedStartDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    actualStartDate: null,
    actualEndDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ConstructionPhase;
}

const defaultPhases = [makePhase()];

// ============================================================================
// EMPTY INPUT
// ============================================================================

describe('computeCPM — empty input', () => {
  it('returns invalid result for empty tasks', () => {
    const result = computeCPM([], defaultPhases);
    expect(result.isValid).toBe(false);
    expect(result.tasks).toEqual([]);
    expect(result.criticalPath).toEqual([]);
    expect(result.criticalPathLength).toBe(0);
  });
});

// ============================================================================
// SINGLE TASK
// ============================================================================

describe('computeCPM — single task', () => {
  it('single task is always critical', () => {
    const tasks = [makeTask({ id: 'A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11' })];
    const result = computeCPM(tasks, defaultPhases);

    expect(result.isValid).toBe(true);
    expect(result.tasks).toHaveLength(1);
    expect(result.criticalPath).toHaveLength(1);
    expect(result.criticalPath[0].taskId).toBe('A');
    expect(result.criticalPath[0].totalFloat).toBe(0);
    expect(result.criticalPath[0].isCritical).toBe(true);
    expect(result.criticalPath[0].durationDays).toBe(10);
  });
});

// ============================================================================
// LINEAR CHAIN (A → B → C)
// ============================================================================

describe('computeCPM — linear chain', () => {
  it('all tasks are critical in a linear chain', () => {
    const tasks = [
      makeTask({ id: 'A', name: 'Task A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
      makeTask({ id: 'B', name: 'Task B', plannedStartDate: '2026-01-11', plannedEndDate: '2026-01-21', dependencies: ['A'] }),
      makeTask({ id: 'C', name: 'Task C', plannedStartDate: '2026-01-21', plannedEndDate: '2026-01-31', dependencies: ['B'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    expect(result.isValid).toBe(true);
    expect(result.tasks).toHaveLength(3);
    expect(result.criticalPath).toHaveLength(3);

    // All should be critical with 0 float
    result.criticalPath.forEach(t => {
      expect(t.isCritical).toBe(true);
      expect(t.totalFloat).toBe(0);
    });

    // Critical path should be ordered by ES
    expect(result.criticalPath[0].taskId).toBe('A');
    expect(result.criticalPath[1].taskId).toBe('B');
    expect(result.criticalPath[2].taskId).toBe('C');
  });

  it('computes correct Early Start / Early Finish', () => {
    const tasks = [
      makeTask({ id: 'A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
      makeTask({ id: 'B', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-06', dependencies: ['A'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);
    const taskB = result.tasks.find(t => t.taskId === 'B');

    // B's ES should be A's EF (2026-01-11)
    expect(taskB?.earlyStart).toBe('2026-01-11');
    // B duration = 5 days, so EF = 2026-01-16
    expect(taskB?.earlyFinish).toBe('2026-01-16');
  });
});

// ============================================================================
// PARALLEL TASKS WITH DIAMOND DEPENDENCY
// ============================================================================

describe('computeCPM — diamond dependency', () => {
  /**
   * DAG shape:
   *     A (10 days)
   *    / \
   *   B   C
   *  (5) (15)
   *    \ /
   *     D (10 days)
   *
   * Critical path: A → C → D (10+15+10 = 35 days)
   * B has float (15-5 = 10 days)
   */
  it('identifies correct critical path in diamond DAG', () => {
    const tasks = [
      makeTask({ id: 'A', name: 'Start', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
      makeTask({ id: 'B', name: 'Short', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-06', dependencies: ['A'] }),
      makeTask({ id: 'C', name: 'Long', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-16', dependencies: ['A'] }),
      makeTask({ id: 'D', name: 'End', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: ['B', 'C'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    expect(result.isValid).toBe(true);

    // Critical path should be A → C → D
    const criticalIds = result.criticalPath.map(t => t.taskId);
    expect(criticalIds).toContain('A');
    expect(criticalIds).toContain('C');
    expect(criticalIds).toContain('D');

    // B should NOT be critical (has float)
    const taskB = result.tasks.find(t => t.taskId === 'B');
    expect(taskB?.isCritical).toBe(false);
    expect(taskB!.totalFloat).toBeGreaterThan(0);
  });

  it('D early start equals max(B.EF, C.EF)', () => {
    const tasks = [
      makeTask({ id: 'A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
      makeTask({ id: 'B', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-06', dependencies: ['A'] }),
      makeTask({ id: 'C', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-16', dependencies: ['A'] }),
      makeTask({ id: 'D', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: ['B', 'C'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    const taskD = result.tasks.find(t => t.taskId === 'D');
    const taskC = result.tasks.find(t => t.taskId === 'C');

    // D's ES should be C's EF (C is longer than B)
    expect(taskD?.earlyStart).toBe(taskC?.earlyFinish);
  });
});

// ============================================================================
// CYCLE DETECTION
// ============================================================================

describe('computeCPM — cycle detection', () => {
  it('detects circular dependency', () => {
    const tasks = [
      makeTask({ id: 'A', dependencies: ['B'] }),
      makeTask({ id: 'B', name: 'Task B', dependencies: ['A'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    expect(result.cyclicTaskIds).toContain('A');
    expect(result.cyclicTaskIds).toContain('B');
  });

  it('marks all-cyclic tasks in cyclicTaskIds with empty result', () => {
    const tasks = [
      makeTask({ id: 'A', dependencies: ['C'] }),
      makeTask({ id: 'B', name: 'Task B', dependencies: ['A'] }),
      makeTask({ id: 'C', name: 'Task C', dependencies: ['B'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    // All 3 form a cycle: A→C→B→A — no valid topological sort
    expect(result.cyclicTaskIds.length).toBe(3);
    expect(result.cyclicTaskIds).toEqual(expect.arrayContaining(['A', 'B', 'C']));
    // When all tasks are cyclic, sortedIds=0 → emptyResult with tasks=[]
    expect(result.tasks).toEqual([]);
    expect(result.isValid).toBe(false);
  });

  it('processes valid tasks even when some are cyclic', () => {
    const tasks = [
      makeTask({ id: 'A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
      makeTask({ id: 'B', name: 'Task B', dependencies: ['C'] }),
      makeTask({ id: 'C', name: 'Task C', dependencies: ['B'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    // A should be processed normally
    const taskA = result.tasks.find(t => t.taskId === 'A');
    expect(taskA?.hasCyclicDependency).toBe(false);
    expect(taskA?.isCritical).toBe(true);

    // B and C should be flagged as cyclic
    expect(result.cyclicTaskIds).toEqual(expect.arrayContaining(['B', 'C']));
  });
});

// ============================================================================
// INVALID DEPENDENCY REFERENCES
// ============================================================================

describe('computeCPM — invalid references', () => {
  it('ignores dependencies to non-existent tasks', () => {
    const tasks = [
      makeTask({ id: 'A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: ['NON_EXISTENT'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    expect(result.isValid).toBe(true);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].taskId).toBe('A');
  });
});

// ============================================================================
// DELAY IMPACT
// ============================================================================

describe('computeCPM — delay impact', () => {
  it('computes delay for completed tasks past EF', () => {
    const tasks = [
      makeTask({
        id: 'A',
        plannedStartDate: '2026-01-01',
        plannedEndDate: '2026-01-11',
        status: 'completed',
        actualEndDate: '2026-01-21', // 10 days late
      }),
    ];
    const result = computeCPM(tasks, defaultPhases);
    expect(result.tasks[0].delayImpactDays).toBe(10);
  });

  it('returns 0 delay for on-time completion', () => {
    const tasks = [
      makeTask({
        id: 'A',
        plannedStartDate: '2026-01-01',
        plannedEndDate: '2026-01-11',
        status: 'completed',
        actualEndDate: '2026-01-05', // early
      }),
    ];
    const result = computeCPM(tasks, defaultPhases);
    expect(result.tasks[0].delayImpactDays).toBe(0);
  });
});

// ============================================================================
// PROJECT EARLY FINISH
// ============================================================================

describe('computeCPM — project finish', () => {
  it('projectEarlyFinish is the max EF across all tasks', () => {
    const tasks = [
      makeTask({ id: 'A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
      makeTask({ id: 'B', name: 'Task B', plannedStartDate: '2026-01-01', plannedEndDate: '2026-02-01', dependencies: [] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    // B is longer, so project end should be based on B's EF
    const taskB = result.tasks.find(t => t.taskId === 'B');
    expect(result.projectEarlyFinish).toBe(taskB?.earlyFinish);
  });

  it('criticalPathLength is the total duration of the critical path', () => {
    const tasks = [
      makeTask({ id: 'A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
      makeTask({ id: 'B', name: 'Task B', plannedStartDate: '2026-01-11', plannedEndDate: '2026-01-21', dependencies: ['A'] }),
    ];
    const result = computeCPM(tasks, defaultPhases);
    expect(result.criticalPathLength).toBe(20); // 10 + 10 days
  });
});

// ============================================================================
// PARALLEL INDEPENDENT TASKS
// ============================================================================

describe('computeCPM — parallel independent tasks', () => {
  it('longest task is critical, shorter has float', () => {
    const tasks = [
      makeTask({ id: 'A', name: 'Short', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-06', dependencies: [] }), // 5 days
      makeTask({ id: 'B', name: 'Long', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-21', dependencies: [] }),  // 20 days
    ];
    const result = computeCPM(tasks, defaultPhases);

    const taskA = result.tasks.find(t => t.taskId === 'A');
    const taskB = result.tasks.find(t => t.taskId === 'B');

    expect(taskB?.isCritical).toBe(true);
    expect(taskA?.isCritical).toBe(false);
    expect(taskA!.totalFloat).toBeGreaterThan(0);
  });

  it('equal-length parallel tasks are both critical', () => {
    const tasks = [
      makeTask({ id: 'A', name: 'Equal A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
      makeTask({ id: 'B', name: 'Equal B', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-11', dependencies: [] }),
    ];
    const result = computeCPM(tasks, defaultPhases);

    // Both have same duration, both are critical
    result.tasks.forEach(t => {
      expect(t.isCritical).toBe(true);
      expect(t.totalFloat).toBe(0);
    });
  });
});

// ============================================================================
// SELF-DEPENDENCY
// ============================================================================

describe('computeCPM — self-dependency', () => {
  it('handles task depending on itself', () => {
    const tasks = [
      makeTask({ id: 'A', dependencies: ['A'] }), // self-reference
    ];
    const result = computeCPM(tasks, defaultPhases);
    // Self-dependency creates a cycle
    expect(result.cyclicTaskIds).toContain('A');
  });
});

// ============================================================================
// LARGE DAG
// ============================================================================

describe('computeCPM — larger DAG (10 tasks)', () => {
  it('processes 10-task linear chain correctly', () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({
        id: `T${i}`,
        name: `Task ${i}`,
        plannedStartDate: '2026-01-01',
        plannedEndDate: '2026-01-06', // 5 days each
        dependencies: i > 0 ? [`T${i - 1}`] : [],
      }),
    );
    const result = computeCPM(tasks, defaultPhases);

    expect(result.isValid).toBe(true);
    expect(result.tasks).toHaveLength(10);
    expect(result.criticalPath).toHaveLength(10); // all critical in linear chain
    expect(result.criticalPathLength).toBe(50); // 10 * 5 days
  });
});

// ============================================================================
// MINIMUM DURATION
// ============================================================================

describe('computeCPM — minimum duration enforcement', () => {
  it('enforces minimum 1-day duration even with same start/end date', () => {
    const tasks = [
      makeTask({ id: 'A', plannedStartDate: '2026-01-01', plannedEndDate: '2026-01-01' }),
    ];
    const result = computeCPM(tasks, defaultPhases);
    expect(result.tasks[0].durationDays).toBe(1); // Math.max(1, ...)
  });
});

// ============================================================================
// PHASE NAME RESOLUTION
// ============================================================================

describe('computeCPM — phase name resolution', () => {
  it('resolves phase name from phases array', () => {
    const phases = [makePhase({ id: 'phase_1', name: 'Foundation' })];
    const tasks = [makeTask({ id: 'A', phaseId: 'phase_1' })];
    const result = computeCPM(tasks, phases);
    expect(result.tasks[0].phaseName).toBe('Foundation');
  });

  it('uses dash when phase not found', () => {
    const tasks = [makeTask({ id: 'A', phaseId: 'unknown_phase' })];
    const result = computeCPM(tasks, []); // no phases
    expect(result.tasks[0].phaseName).toBe('—');
  });
});
