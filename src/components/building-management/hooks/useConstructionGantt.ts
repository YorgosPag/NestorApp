'use client';

/**
 * useConstructionGantt — Data hook for Gantt chart (ADR-034)
 *
 * Loads construction phases and tasks from Firestore via API,
 * converts them to react-modern-gantt TaskGroup[] format,
 * and provides CRUD handlers for editing.
 *
 * @see src/components/building-management/construction-services.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import { calculateGanttStats } from '../tabs/TimelineTabContent/gantt/gantt-mock-data';
import { getConstructionData } from '../construction-services';
import { buildTaskGroups } from './construction-gantt/construction-gantt-utils';
import { useConstructionGanttCrud } from './construction-gantt/useConstructionGanttCrud';
import { useConstructionGanttDialog } from './construction-gantt/useConstructionGanttDialog';
import { useConstructionGanttInteractions } from './construction-gantt/useConstructionGanttInteractions';
import type { UseConstructionGanttReturn } from './construction-gantt/construction-gantt-types';

const logger = createModuleLogger('useConstructionGantt');

export function useConstructionGantt(buildingId: string): UseConstructionGanttReturn {
  const [phases, setPhases] = useState<ConstructionPhase[]>([]);
  const [tasks, setTasks] = useState<ConstructionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!buildingId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getConstructionData(buildingId);
      setPhases(data.phases);
      setTasks(data.tasks);
    } catch (loadError) {
      logger.error('Error loading data', { error: loadError });
      setError(loadError instanceof Error ? loadError.message : 'Failed to load construction data');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const dialog = useConstructionGanttDialog();

  const taskGroups = useMemo(() => buildTaskGroups(phases, tasks), [phases, tasks]);
  const stats = useMemo(() => calculateGanttStats(taskGroups), [taskGroups]);

  const interactions = useConstructionGanttInteractions({
    buildingId,
    phases,
    tasks,
    setPhases,
    setTasks,
    openEditPhaseDialog: dialog.openEditPhaseDialog,
    openEditTaskDialog: dialog.openEditTaskDialog,
  });

  const crud = useConstructionGanttCrud({
    buildingId,
    tasks,
    loadData,
    setPhases,
    setTasks,
  });

  return {
    taskGroups,
    stats,
    phases,
    tasks,
    loading,
    error,
    isEmpty: !loading && phases.length === 0,
    dialogState: dialog.dialogState,
    openCreatePhaseDialog: dialog.openCreatePhaseDialog,
    openEditPhaseDialog: dialog.openEditPhaseDialog,
    openCreateTaskDialog: dialog.openCreateTaskDialog,
    openEditTaskDialog: dialog.openEditTaskDialog,
    closeDialog: dialog.closeDialog,
    handleTaskUpdate: interactions.handleTaskUpdate,
    handleTaskClick: interactions.handleTaskClick,
    handleTaskDoubleClick: interactions.handleTaskDoubleClick,
    handleGroupClick: interactions.handleGroupClick,
    savePhase: crud.savePhase,
    updatePhase: crud.updatePhaseHandler,
    removePhase: crud.removePhase,
    saveTask: crud.saveTask,
    updateTask: crud.updateTaskHandler,
    removeTask: crud.removeTask,
    updateBarColor: crud.updateBarColor,
    reload: loadData,
  };
}
