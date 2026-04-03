import { useCallback } from 'react';
import type {
  ConstructionPhase,
  ConstructionPhaseCreatePayload,
  ConstructionTask,
  ConstructionTaskCreatePayload,
} from '@/types/building/construction';
import {
  createConstructionPhaseWithPolicy,
  createConstructionTaskWithPolicy,
  deleteConstructionPhaseWithPolicy,
  deleteConstructionTaskWithPolicy,
  updateConstructionPhaseWithPolicy,
  updateConstructionTaskWithPolicy,
} from '@/services/construction-mutation-gateway';

interface UseConstructionGanttCrudProps {
  buildingId: string;
  tasks: ConstructionTask[];
  loadData: () => Promise<void>;
  setPhases: React.Dispatch<React.SetStateAction<ConstructionPhase[]>>;
  setTasks: React.Dispatch<React.SetStateAction<ConstructionTask[]>>;
}

export function useConstructionGanttCrud({
  buildingId,
  tasks,
  loadData,
  setPhases,
  setTasks,
}: UseConstructionGanttCrudProps) {
  const savePhase = useCallback(async (data: ConstructionPhaseCreatePayload): Promise<boolean> => {
    const result = await createConstructionPhaseWithPolicy({ buildingId, data });
    if (result.success) {
      await loadData();
    }
    return result.success;
  }, [buildingId, loadData]);

  const updatePhaseHandler = useCallback(async (phaseId: string, updates: Record<string, unknown>): Promise<boolean> => {
    const result = await updateConstructionPhaseWithPolicy({ buildingId, phaseId, updates });
    if (result.success) {
      await loadData();
    }
    return result.success;
  }, [buildingId, loadData]);

  const removePhase = useCallback(async (phaseId: string): Promise<boolean> => {
    const result = await deleteConstructionPhaseWithPolicy({ buildingId, phaseId });
    if (result.success) {
      await loadData();
    }
    return result.success;
  }, [buildingId, loadData]);

  const saveTask = useCallback(async (data: ConstructionTaskCreatePayload): Promise<boolean> => {
    const result = await createConstructionTaskWithPolicy({ buildingId, data });
    if (result.success && result.taskId) {
      const taskId = result.taskId;
      setTasks((previous) => [...previous, {
        id: taskId,
        phaseId: data.phaseId,
        buildingId,
        companyId: '',
        name: data.name,
        code: data.code ?? '',
        order: data.order ?? tasks.filter((task) => task.phaseId === data.phaseId).length,
        status: data.status ?? 'notStarted',
        plannedStartDate: data.plannedStartDate,
        plannedEndDate: data.plannedEndDate,
        progress: 0,
        dependencies: data.dependencies ?? [],
        description: data.description,
      }]);

      void loadData();
    }
    return result.success;
  }, [buildingId, loadData, setTasks, tasks]);

  const updateTaskHandler = useCallback(async (taskId: string, updates: Record<string, unknown>): Promise<boolean> => {
    const result = await updateConstructionTaskWithPolicy({ buildingId, taskId, updates });
    if (result.success) {
      await loadData();
    }
    return result.success;
  }, [buildingId, loadData]);

  const removeTask = useCallback(async (taskId: string): Promise<boolean> => {
    const result = await deleteConstructionTaskWithPolicy({ buildingId, taskId });
    if (result.success) {
      await loadData();
    }
    return result.success;
  }, [buildingId, loadData]);

  const updateBarColor = useCallback(async (id: string, isPhase: boolean, color: string): Promise<void> => {
    if (isPhase) {
      setPhases((previous) => previous.map((phase) => phase.id === id ? { ...phase, barColor: color } : phase));
      await updateConstructionPhaseWithPolicy({ buildingId, phaseId: id, updates: { barColor: color } });
      return;
    }

    setTasks((previous) => previous.map((task) => task.id === id ? { ...task, barColor: color } : task));
    await updateConstructionTaskWithPolicy({ buildingId, taskId: id, updates: { barColor: color } });
  }, [buildingId, setPhases, setTasks]);

  return {
    savePhase,
    updatePhaseHandler,
    removePhase,
    saveTask,
    updateTaskHandler,
    removeTask,
    updateBarColor,
  };
}
