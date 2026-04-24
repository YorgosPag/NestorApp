/**
 * Gantt Chart Mock Data - Construction Phases (ADR-034)
 *
 * 8 realistic construction phases for a residential building.
 * Data model: TaskGroup[] for react-modern-gantt.
 * Each TaskGroup = construction phase, each Task = individual work item.
 *
 * Colors are NOT hardcoded here β€” they are resolved dynamically
 * via the `getTaskColor` prop in GanttView.tsx using semantic color tokens.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import type { TaskGroup, Task } from 'react-modern-gantt';

// β”€β”€β”€ Task Status Type β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€
// Stored as metadata on each task, used by GanttView to resolve colors

export type GanttTaskStatus = 'completed' | 'inProgress' | 'notStarted' | 'delayed' | 'blocked';

// β”€β”€β”€ Summary Statistics β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€β”€

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
