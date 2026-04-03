import { useCallback } from 'react';
import type { Task, TaskGroup } from 'react-modern-gantt';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import {
  updateConstructionPhaseWithPolicy,
  updateConstructionTaskWithPolicy,
} from '@/services/construction-mutation-gateway';
import { parseLocalDate, toLocalDateString } from './construction-gantt-types';

interface UseConstructionGanttInteractionsProps {
  buildingId: string;
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  setPhases: React.Dispatch<React.SetStateAction<ConstructionPhase[]>>;
  setTasks: React.Dispatch<React.SetStateAction<ConstructionTask[]>>;
  openEditPhaseDialog: (phase: ConstructionPhase) => void;
  openEditTaskDialog: (task: ConstructionTask) => void;
}

export function useConstructionGanttInteractions({
  buildingId,
  phases,
  tasks,
  setPhases,
  setTasks,
  openEditPhaseDialog,
  openEditTaskDialog,
}: UseConstructionGanttInteractionsProps) {
  const handleTaskUpdate = useCallback(async (groupId: string, updatedTask: Task) => {
    const startDate = updatedTask.startDate instanceof Date ? toLocalDateString(updatedTask.startDate) : String(updatedTask.startDate);
    const endDate = updatedTask.endDate instanceof Date ? toLocalDateString(updatedTask.endDate) : String(updatedTask.endDate);

    if (updatedTask.id.startsWith('phase-bar-')) {
      const phaseId = groupId;
      const phase = phases.find((item) => item.id === phaseId);
      if (!phase) {
        return;
      }

      const oldStart = parseLocalDate(phase.plannedStartDate).getTime();
      const newStart = parseLocalDate(startDate).getTime();
      const offsetMs = newStart - oldStart;

      setPhases((previous) => previous.map((item) => item.id === phaseId ? {
        ...item,
        plannedStartDate: startDate,
        plannedEndDate: endDate,
        progress: updatedTask.percent ?? item.progress,
      } : item));

      await updateConstructionPhaseWithPolicy({ buildingId, phaseId, updates: {
        plannedStartDate: startDate,
        plannedEndDate: endDate,
        progress: updatedTask.percent,
      }});

      if (offsetMs !== 0) {
        const childTasks = tasks.filter((item) => item.phaseId === phaseId);
        if (childTasks.length > 0) {
          setTasks((previous) => previous.map((item) => {
            if (item.phaseId !== phaseId) {
              return item;
            }

            const taskStart = parseLocalDate(item.plannedStartDate);
            const taskEnd = parseLocalDate(item.plannedEndDate);
            taskStart.setTime(taskStart.getTime() + offsetMs);
            taskEnd.setTime(taskEnd.getTime() + offsetMs);
            return {
              ...item,
              plannedStartDate: toLocalDateString(taskStart),
              plannedEndDate: toLocalDateString(taskEnd),
            };
          }));

          await Promise.all(childTasks.map((item) => {
            const taskStart = parseLocalDate(item.plannedStartDate);
            const taskEnd = parseLocalDate(item.plannedEndDate);
            taskStart.setTime(taskStart.getTime() + offsetMs);
            taskEnd.setTime(taskEnd.getTime() + offsetMs);
            return updateConstructionTaskWithPolicy({ buildingId, taskId: item.id, updates: {
              plannedStartDate: toLocalDateString(taskStart),
              plannedEndDate: toLocalDateString(taskEnd),
            }});
          }));
        }
      }

      return;
    }

    setTasks((previous) => previous.map((item) => item.id === updatedTask.id ? {
      ...item,
      plannedStartDate: startDate,
      plannedEndDate: endDate,
      progress: updatedTask.percent ?? item.progress,
    } : item));

    await updateConstructionTaskWithPolicy({ buildingId, taskId: updatedTask.id, updates: {
      plannedStartDate: startDate,
      plannedEndDate: endDate,
      progress: updatedTask.percent,
    }});

    const phase = phases.find((item) => item.id === groupId);
    if (!phase) {
      return;
    }

    const phaseStart = parseLocalDate(phase.plannedStartDate);
    const phaseEnd = parseLocalDate(phase.plannedEndDate);
    const taskStart = parseLocalDate(startDate);
    const taskEnd = parseLocalDate(endDate);
    const newPhaseStart = taskStart < phaseStart ? toLocalDateString(taskStart) : phase.plannedStartDate;
    const newPhaseEnd = taskEnd > phaseEnd ? toLocalDateString(taskEnd) : phase.plannedEndDate;

    if (newPhaseStart !== phase.plannedStartDate || newPhaseEnd !== phase.plannedEndDate) {
      setPhases((previous) => previous.map((item) => item.id === groupId ? {
        ...item,
        plannedStartDate: newPhaseStart,
        plannedEndDate: newPhaseEnd,
      } : item));

      await updateConstructionPhaseWithPolicy({ buildingId, phaseId: groupId, updates: {
        plannedStartDate: newPhaseStart,
        plannedEndDate: newPhaseEnd,
      }});
    }
  }, [buildingId, phases, setPhases, setTasks, tasks]);

  const handleTaskClick = useCallback((clickedTask: Task, group: TaskGroup) => {
    if (clickedTask.id.startsWith('phase-bar-')) {
      const fullPhase = phases.find((item) => item.id === group.id);
      if (fullPhase) {
        openEditPhaseDialog(fullPhase);
      }
      return;
    }

    const fullTask = tasks.find((item) => item.id === clickedTask.id);
    if (fullTask) {
      openEditTaskDialog(fullTask);
    }
  }, [openEditPhaseDialog, openEditTaskDialog, phases, tasks]);

  const handleTaskDoubleClick = useCallback((clickedTask: Task) => {
    if (clickedTask.id.startsWith('phase-bar-')) {
      const phaseId = clickedTask.id.replace('phase-bar-', '');
      const fullPhase = phases.find((item) => item.id === phaseId);
      if (fullPhase) {
        openEditPhaseDialog(fullPhase);
      }
      return;
    }

    const fullTask = tasks.find((item) => item.id === clickedTask.id);
    if (fullTask) {
      openEditTaskDialog(fullTask);
    }
  }, [openEditPhaseDialog, openEditTaskDialog, phases, tasks]);

  const handleGroupClick = useCallback((group: TaskGroup) => {
    const fullPhase = phases.find((item) => item.id === group.id);
    if (fullPhase) {
      openEditPhaseDialog(fullPhase);
    }
  }, [openEditPhaseDialog, phases]);

  return {
    handleTaskUpdate,
    handleTaskClick,
    handleTaskDoubleClick,
    handleGroupClick,
  };
}
