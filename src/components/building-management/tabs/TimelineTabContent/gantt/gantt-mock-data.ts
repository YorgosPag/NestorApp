/**
 * Gantt Chart Mock Data - Construction Phases (ADR-034)
 *
 * 8 realistic construction phases for a residential building.
 * Data model: TaskGroup[] for react-modern-gantt.
 * Each TaskGroup = construction phase, each Task = individual work item.
 *
 * Colors are NOT hardcoded here — they are resolved dynamically
 * via the `getTaskColor` prop in GanttView.tsx using semantic color tokens.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import type { TaskGroup, Task } from 'react-modern-gantt';

// ─── Task Status Type ─────────────────────────────────────────────────────
// Stored as metadata on each task, used by GanttView to resolve colors

export type GanttTaskStatus = 'completed' | 'inProgress' | 'notStarted' | 'delayed' | 'blocked';

// ─── Helper: Create Task with status metadata ────────────────────────────
function createTask(
  id: string,
  nameKey: string,
  startDate: string,
  endDate: string,
  percent: number,
  taskStatus: GanttTaskStatus,
  dependencies?: string[]
): Task {
  return {
    id,
    name: nameKey,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    percent,
    dependencies: dependencies ?? [],
    taskStatus,
  };
}

// ─── Mock Data: 8 Construction Phases ─────────────────────────────────────

export function getGanttMockData(
  t: (key: string) => string
): TaskGroup[] {
  return [
    // Phase 1: Excavation & Foundation (COMPLETED)
    {
      id: 'ph-001',
      name: t('tabs.timeline.gantt.phases.excavationFoundation'),
      description: 'PH-001',
      tasks: [
        createTask('tsk-001', t('tabs.timeline.gantt.tasks.excavation'), '2025-03-01', '2025-03-25', 100, 'completed'),
        createTask('tsk-002', t('tabs.timeline.gantt.tasks.reinforcement'), '2025-03-20', '2025-04-15', 100, 'completed', ['tsk-001']),
        createTask('tsk-003', t('tabs.timeline.gantt.tasks.concretePour'), '2025-04-10', '2025-05-05', 100, 'completed', ['tsk-002']),
        createTask('tsk-004', t('tabs.timeline.gantt.tasks.basementWalls'), '2025-04-25', '2025-05-20', 100, 'completed', ['tsk-003']),
      ],
    },

    // Phase 2: Structure (COMPLETED)
    {
      id: 'ph-002',
      name: t('tabs.timeline.gantt.phases.structure'),
      description: 'PH-002',
      tasks: [
        createTask('tsk-005', t('tabs.timeline.gantt.tasks.columns'), '2025-05-25', '2025-06-30', 100, 'completed', ['tsk-004']),
        createTask('tsk-006', t('tabs.timeline.gantt.tasks.beamsSlabs'), '2025-06-15', '2025-09-15', 100, 'completed', ['tsk-005']),
        createTask('tsk-007', t('tabs.timeline.gantt.tasks.staircase'), '2025-08-01', '2025-10-15', 100, 'completed', ['tsk-005']),
      ],
    },

    // Phase 3: Masonry & Roofing (IN PROGRESS - 75%)
    {
      id: 'ph-003',
      name: t('tabs.timeline.gantt.phases.masonryRoofing'),
      description: 'PH-003',
      tasks: [
        createTask('tsk-008', t('tabs.timeline.gantt.tasks.externalWalls'), '2025-10-20', '2025-12-15', 90, 'inProgress', ['tsk-006']),
        createTask('tsk-009', t('tabs.timeline.gantt.tasks.internalWalls'), '2025-11-01', '2026-01-15', 70, 'inProgress', ['tsk-006']),
        createTask('tsk-010', t('tabs.timeline.gantt.tasks.roofStructure'), '2025-12-01', '2026-02-28', 50, 'inProgress', ['tsk-008']),
      ],
    },

    // Phase 4: M&E Installations (IN PROGRESS - 30%)
    {
      id: 'ph-004',
      name: t('tabs.timeline.gantt.phases.mecInstallations'),
      description: 'PH-004',
      tasks: [
        createTask('tsk-011', t('tabs.timeline.gantt.tasks.plumbing'), '2025-11-15', '2026-02-15', 45, 'inProgress', ['tsk-009']),
        createTask('tsk-012', t('tabs.timeline.gantt.tasks.electrical'), '2025-12-01', '2026-03-01', 30, 'inProgress', ['tsk-009']),
        createTask('tsk-013', t('tabs.timeline.gantt.tasks.hvac'), '2026-01-15', '2026-03-15', 10, 'delayed', ['tsk-011']),
        createTask('tsk-014', t('tabs.timeline.gantt.tasks.elevator'), '2026-02-01', '2026-04-15', 0, 'notStarted', ['tsk-005']),
      ],
    },

    // Phase 5: Insulation & Plastering (NOT STARTED)
    {
      id: 'ph-005',
      name: t('tabs.timeline.gantt.phases.insulationPlastering'),
      description: 'PH-005',
      tasks: [
        createTask('tsk-015', t('tabs.timeline.gantt.tasks.thermalInsulation'), '2026-01-15', '2026-03-01', 0, 'notStarted', ['tsk-008']),
        createTask('tsk-016', t('tabs.timeline.gantt.tasks.waterproofing'), '2026-02-01', '2026-03-15', 0, 'notStarted', ['tsk-010']),
        createTask('tsk-017', t('tabs.timeline.gantt.tasks.internalPlastering'), '2026-03-01', '2026-04-15', 0, 'notStarted', ['tsk-009', 'tsk-012']),
        createTask('tsk-018', t('tabs.timeline.gantt.tasks.externalPlastering'), '2026-03-15', '2026-04-30', 0, 'notStarted', ['tsk-015']),
      ],
    },

    // Phase 6: Flooring & Painting (NOT STARTED)
    {
      id: 'ph-006',
      name: t('tabs.timeline.gantt.phases.flooringPainting'),
      description: 'PH-006',
      tasks: [
        createTask('tsk-019', t('tabs.timeline.gantt.tasks.tiling'), '2026-04-01', '2026-05-15', 0, 'notStarted', ['tsk-017']),
        createTask('tsk-020', t('tabs.timeline.gantt.tasks.woodenFloors'), '2026-05-01', '2026-06-01', 0, 'notStarted', ['tsk-017']),
        createTask('tsk-021', t('tabs.timeline.gantt.tasks.internalPainting'), '2026-05-15', '2026-06-15', 0, 'notStarted', ['tsk-017']),
        createTask('tsk-022', t('tabs.timeline.gantt.tasks.externalPainting'), '2026-05-01', '2026-06-30', 0, 'notStarted', ['tsk-018']),
      ],
    },

    // Phase 7: Fixtures & Finishes (NOT STARTED)
    {
      id: 'ph-007',
      name: t('tabs.timeline.gantt.phases.fixturesFinishes'),
      description: 'PH-007',
      tasks: [
        createTask('tsk-023', t('tabs.timeline.gantt.tasks.doorsFitting'), '2026-06-01', '2026-07-15', 0, 'notStarted', ['tsk-021']),
        createTask('tsk-024', t('tabs.timeline.gantt.tasks.kitchenBathroom'), '2026-06-15', '2026-08-01', 0, 'notStarted', ['tsk-019', 'tsk-011']),
        createTask('tsk-025', t('tabs.timeline.gantt.tasks.lighting'), '2026-07-01', '2026-08-15', 0, 'notStarted', ['tsk-012', 'tsk-021']),
      ],
    },

    // Phase 8: Landscaping & Handover (NOT STARTED)
    {
      id: 'ph-008',
      name: t('tabs.timeline.gantt.phases.landscapingHandover'),
      description: 'PH-008',
      tasks: [
        createTask('tsk-026', t('tabs.timeline.gantt.tasks.landscaping'), '2026-08-01', '2026-09-01', 0, 'notStarted', ['tsk-022']),
        createTask('tsk-027', t('tabs.timeline.gantt.tasks.finalInspection'), '2026-09-01', '2026-09-15', 0, 'notStarted', ['tsk-023', 'tsk-024', 'tsk-025', 'tsk-026']),
        createTask('tsk-028', t('tabs.timeline.gantt.tasks.handover'), '2026-09-15', '2026-09-30', 0, 'notStarted', ['tsk-027']),
      ],
    },
  ];
}

// ─── Summary Statistics ───────────────────────────────────────────────────

export interface GanttSummaryStats {
  totalPhases: number;
  completedPhases: number;
  inProgressPhases: number;
  notStartedPhases: number;
  delayedPhases: number;
  overallProgress: number;
}

export function calculateGanttStats(taskGroups: TaskGroup[]): GanttSummaryStats {
  let completedPhases = 0;
  let inProgressPhases = 0;
  let notStartedPhases = 0;
  let delayedPhases = 0;
  let totalProgress = 0;

  for (const group of taskGroups) {
    const tasks = group.tasks;
    if (tasks.length === 0) continue;

    const avgProgress = tasks.reduce((sum, task) => sum + (task.percent ?? 0), 0) / tasks.length;
    totalProgress += avgProgress;

    const hasDelayed = tasks.some((task) => task.taskStatus === 'delayed');

    if (avgProgress === 100) {
      completedPhases++;
    } else if (hasDelayed) {
      delayedPhases++;
    } else if (avgProgress > 0) {
      inProgressPhases++;
    } else {
      notStartedPhases++;
    }
  }

  const totalPhases = taskGroups.length;
  const overallProgress = totalPhases > 0 ? Math.round(totalProgress / totalPhases) : 0;

  return {
    totalPhases,
    completedPhases,
    inProgressPhases,
    notStartedPhases,
    delayedPhases,
    overallProgress,
  };
}
