import type { Task, TaskGroup } from 'react-modern-gantt';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import {
  GANTT_STATUS_COLORS,
  mapPhaseStatusToGantt,
  mapTaskStatusToGantt,
  parseLocalDate,
} from './construction-gantt-types';

export function buildTaskGroups(phases: ConstructionPhase[], tasks: ConstructionTask[]): TaskGroup[] {
  return phases.map((phase) => {
    const phaseTasks = tasks
      .filter((task) => task.phaseId === phase.id)
      .sort((first, second) => first.order - second.order);

    const phaseGanttStatus = mapPhaseStatusToGantt(phase.status);
    const syntheticPhaseBar: Task = {
      id: `phase-bar-${phase.id}`,
      name: phase.name,
      startDate: parseLocalDate(phase.plannedStartDate),
      endDate: parseLocalDate(phase.plannedEndDate),
      percent: phase.progress,
      dependencies: [],
      taskStatus: phaseGanttStatus,
      color: phase.barColor ?? GANTT_STATUS_COLORS[phaseGanttStatus],
      barColor: phase.barColor,
    };

    const realTasks: Task[] = phaseTasks.map((task) => {
      const ganttStatus = mapTaskStatusToGantt(task.status);
      return {
        id: task.id,
        name: task.name,
        startDate: parseLocalDate(task.plannedStartDate),
        endDate: parseLocalDate(task.plannedEndDate),
        percent: task.progress,
        dependencies: task.dependencies ?? [],
        taskStatus: ganttStatus,
        color: task.barColor ?? GANTT_STATUS_COLORS[ganttStatus],
        barColor: task.barColor,
      };
    });

    return {
      id: phase.id,
      name: phase.name,
      description: phase.code,
      tasks: [syntheticPhaseBar, ...realTasks],
    };
  });
}
