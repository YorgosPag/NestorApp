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
import type { Task, TaskGroup } from 'react-modern-gantt';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  ConstructionPhase,
  ConstructionTask,
  ConstructionPhaseCreatePayload,
  ConstructionTaskCreatePayload,
  ConstructionPhaseStatus,
  ConstructionTaskStatus,
} from '@/types/building/construction';
import { calculateGanttStats } from '../tabs/TimelineTabContent/gantt/gantt-mock-data';
import type { GanttSummaryStats, GanttTaskStatus } from '../tabs/TimelineTabContent/gantt/gantt-mock-data';
import {
  getConstructionData,
  createConstructionPhase,
  updateConstructionPhase,
  deleteConstructionPhase,
  createConstructionTask,
  updateConstructionTask,
  deleteConstructionTask,
} from '../construction-services';

// ─── Types ───────────────────────────────────────────────────────────────

interface DialogState {
  open: boolean;
  mode: 'createPhase' | 'editPhase' | 'createTask' | 'editTask';
  phase?: ConstructionPhase;
  task?: ConstructionTask;
  phaseId?: string; // For creating task under specific phase
}

interface UseConstructionGanttReturn {
  // Data for GanttChart
  taskGroups: TaskGroup[];
  stats: GanttSummaryStats;

  // Raw data
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];

  // State
  loading: boolean;
  error: string | null;
  isEmpty: boolean;

  // Dialog
  dialogState: DialogState;
  openCreatePhaseDialog: () => void;
  openEditPhaseDialog: (phase: ConstructionPhase) => void;
  openCreateTaskDialog: (phaseId: string) => void;
  openEditTaskDialog: (task: ConstructionTask) => void;
  closeDialog: () => void;

  // Gantt event handlers
  handleTaskUpdate: (groupId: string, updatedTask: Task) => void;
  handleTaskClick: (task: Task, group: TaskGroup) => void;
  handleGroupClick: (group: TaskGroup) => void;

  // CRUD
  savePhase: (data: ConstructionPhaseCreatePayload) => Promise<boolean>;
  updatePhase: (phaseId: string, updates: Record<string, unknown>) => Promise<boolean>;
  removePhase: (phaseId: string) => Promise<boolean>;
  saveTask: (data: ConstructionTaskCreatePayload) => Promise<boolean>;
  updateTask: (taskId: string, updates: Record<string, unknown>) => Promise<boolean>;
  removeTask: (taskId: string) => Promise<boolean>;

  // Reload
  reload: () => Promise<void>;
}

// ─── Status Colors ──────────────────────────────────────────────────────
// Centralized CSS variable references for Gantt bar colors (from globals.css)
// react-modern-gantt uses task.color for bar backgroundColor

const GANTT_STATUS_COLORS: Record<GanttTaskStatus, string> = {
  completed: 'hsl(var(--status-success))',
  inProgress: 'hsl(var(--status-info))',
  notStarted: 'hsl(var(--muted-foreground))',
  delayed: 'hsl(var(--status-error))',
  blocked: 'hsl(var(--status-warning))',
};

// ─── Status Mapping ──────────────────────────────────────────────────────
// Maps ConstructionTaskStatus → GanttTaskStatus for color resolver

function mapTaskStatusToGantt(status: ConstructionTaskStatus): GanttTaskStatus {
  switch (status) {
    case 'completed': return 'completed';
    case 'inProgress': return 'inProgress';
    case 'notStarted': return 'notStarted';
    case 'delayed': return 'delayed';
    case 'blocked': return 'blocked';
    default: return 'notStarted';
  }
}

function mapPhaseStatusToGantt(status: ConstructionPhaseStatus): GanttTaskStatus {
  switch (status) {
    case 'completed': return 'completed';
    case 'inProgress': return 'inProgress';
    case 'planning': return 'notStarted';
    case 'delayed': return 'delayed';
    case 'blocked': return 'blocked';
    default: return 'notStarted';
  }
}

/**
 * Parses a date string (e.g. "2026-02-01") as LOCAL midnight.
 *
 * JavaScript's `new Date("2026-02-01")` interprets date-only strings as UTC,
 * which creates a timezone offset (e.g. UTC+2 in Greece → bar appears 2h early).
 * Adding T00:00:00 forces local timezone interpretation per ECMA-262.
 */
function parseLocalDate(dateStr: string): Date {
  // If already has time component, use as-is
  if (dateStr.includes('T')) return new Date(dateStr);
  // Add local midnight time to prevent UTC interpretation
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * Extracts a LOCAL date string (YYYY-MM-DD) from a Date object.
 *
 * CRITICAL: Do NOT use `toISOString().split('T')[0]` — that converts to UTC first,
 * which in Greece (UTC+2) can shift the date by -1 day for evening times.
 * This function uses local date methods for correct snap-to-day behavior.
 */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useConstructionGantt(buildingId: string): UseConstructionGanttReturn {
  const { t } = useTranslation('building');

  // State
  const [phases, setPhases] = useState<ConstructionPhase[]>([]);
  const [tasks, setTasks] = useState<ConstructionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    mode: 'createPhase',
  });

  // ─── Load Data ───────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!buildingId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getConstructionData(buildingId);

      // 🔍 DEBUG: Log loaded data to diagnose task visibility issue
      console.log(`🔍 [useConstructionGantt] Loaded ${data.phases.length} phases, ${data.tasks.length} tasks`);
      if (data.tasks.length > 0) {
        console.log('🔍 [useConstructionGantt] Tasks:', data.tasks.map((t) => ({
          id: t.id, name: t.name, phaseId: t.phaseId, status: t.status,
        })));
        console.log('🔍 [useConstructionGantt] Phase IDs:', data.phases.map((p) => p.id));
      }

      setPhases(data.phases);
      setTasks(data.tasks);
    } catch (err) {
      console.error('❌ [useConstructionGantt] Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load construction data');
    } finally {
      setLoading(false);
    }
  }, [buildingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Convert to TaskGroup[] for react-modern-gantt ────────────────────

  const taskGroups = useMemo((): TaskGroup[] => {
    // 🔍 DEBUG: Log matching
    if (tasks.length > 0) {
      console.log(`🔍 [taskGroups] Matching ${tasks.length} tasks against ${phases.length} phases`);
    }

    return phases.map((phase) => {
      const phaseTasks = tasks
        .filter((task) => task.phaseId === phase.id)
        .sort((a, b) => a.order - b.order);

      // 🔍 DEBUG: Log per-phase matching
      if (tasks.length > 0) {
        console.log(`🔍 [taskGroups] Phase "${phase.name}" (${phase.id}): ${phaseTasks.length} matched tasks`);
      }

      let ganttTasks: Task[];

      if (phaseTasks.length > 0) {
        // Phase has real tasks → show them as bars
        ganttTasks = phaseTasks.map((task) => {
          const ganttStatus = mapTaskStatusToGantt(task.status);
          return {
            id: task.id,
            name: task.name,
            startDate: parseLocalDate(task.plannedStartDate),
            endDate: parseLocalDate(task.plannedEndDate),
            percent: task.progress,
            dependencies: task.dependencies ?? [],
            taskStatus: ganttStatus,
            color: GANTT_STATUS_COLORS[ganttStatus],
          };
        });
      } else {
        // Phase has no tasks → create synthetic bar from phase dates
        const ganttStatus = mapPhaseStatusToGantt(phase.status);
        ganttTasks = [{
          id: `phase-bar-${phase.id}`,
          name: phase.name,
          startDate: parseLocalDate(phase.plannedStartDate),
          endDate: parseLocalDate(phase.plannedEndDate),
          percent: phase.progress,
          dependencies: [],
          taskStatus: ganttStatus,
          color: GANTT_STATUS_COLORS[ganttStatus],
        }];
      }

      return {
        id: phase.id,
        name: phase.name,
        description: phase.code,
        tasks: ganttTasks,
      };
    });
  }, [phases, tasks]);

  // ─── Statistics ────────────────────────────────────────────────────────

  const stats = useMemo(() => calculateGanttStats(taskGroups), [taskGroups]);

  // ─── Dialog Handlers ──────────────────────────────────────────────────

  const openCreatePhaseDialog = useCallback(() => {
    setDialogState({ open: true, mode: 'createPhase' });
  }, []);

  const openEditPhaseDialog = useCallback((phase: ConstructionPhase) => {
    setDialogState({ open: true, mode: 'editPhase', phase });
  }, []);

  const openCreateTaskDialog = useCallback((phaseId: string) => {
    setDialogState({ open: true, mode: 'createTask', phaseId });
  }, []);

  const openEditTaskDialog = useCallback((task: ConstructionTask) => {
    setDialogState({ open: true, mode: 'editTask', task });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState({ open: false, mode: 'createPhase' });
  }, []);

  // ─── Gantt Event Handlers ─────────────────────────────────────────────

  const handleTaskUpdate = useCallback(
    async (groupId: string, updatedTask: Task) => {
      // Drag/resize callback from react-modern-gantt
      // Use local timezone conversion to snap to day boundaries correctly
      const startDate = updatedTask.startDate instanceof Date
        ? toLocalDateString(updatedTask.startDate)
        : String(updatedTask.startDate);
      const endDate = updatedTask.endDate instanceof Date
        ? toLocalDateString(updatedTask.endDate)
        : String(updatedTask.endDate);

      // Synthetic phase bars → update the phase, not a task
      if (updatedTask.id.startsWith('phase-bar-')) {
        const phaseId = groupId;
        setPhases((prev) =>
          prev.map((phase) =>
            phase.id === phaseId
              ? {
                  ...phase,
                  plannedStartDate: startDate,
                  plannedEndDate: endDate,
                  progress: updatedTask.percent ?? phase.progress,
                }
              : phase
          )
        );
        await updateConstructionPhase(buildingId, phaseId, {
          plannedStartDate: startDate,
          plannedEndDate: endDate,
          progress: updatedTask.percent,
        });
        return;
      }

      // Real task → optimistic update + persist
      setTasks((prev) =>
        prev.map((task) =>
          task.id === updatedTask.id
            ? {
                ...task,
                plannedStartDate: startDate,
                plannedEndDate: endDate,
                progress: updatedTask.percent ?? task.progress,
              }
            : task
        )
      );

      await updateConstructionTask(buildingId, updatedTask.id, {
        plannedStartDate: startDate,
        plannedEndDate: endDate,
        progress: updatedTask.percent,
      });
    },
    [buildingId]
  );

  const handleTaskClick = useCallback(
    (clickedTask: Task, group: TaskGroup) => {
      // Synthetic phase bars have IDs starting with "phase-bar-"
      if (clickedTask.id.startsWith('phase-bar-')) {
        const fullPhase = phases.find((p) => p.id === group.id);
        if (fullPhase) {
          openEditPhaseDialog(fullPhase);
        }
        return;
      }

      const fullTask = tasks.find((t) => t.id === clickedTask.id);
      if (fullTask) {
        openEditTaskDialog(fullTask);
      }
    },
    [phases, tasks, openEditPhaseDialog, openEditTaskDialog]
  );

  const handleGroupClick = useCallback(
    (group: TaskGroup) => {
      const fullPhase = phases.find((p) => p.id === group.id);
      if (fullPhase) {
        openEditPhaseDialog(fullPhase);
      }
    },
    [phases, openEditPhaseDialog]
  );

  // ─── CRUD Operations ──────────────────────────────────────────────────

  const savePhase = useCallback(
    async (data: ConstructionPhaseCreatePayload): Promise<boolean> => {
      const result = await createConstructionPhase(buildingId, data);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  const updatePhaseHandler = useCallback(
    async (phaseId: string, updates: Record<string, unknown>): Promise<boolean> => {
      const result = await updateConstructionPhase(buildingId, phaseId, updates);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  const removePhase = useCallback(
    async (phaseId: string): Promise<boolean> => {
      const result = await deleteConstructionPhase(buildingId, phaseId);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  const saveTask = useCallback(
    async (data: ConstructionTaskCreatePayload): Promise<boolean> => {
      const result = await createConstructionTask(buildingId, data);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  const updateTaskHandler = useCallback(
    async (taskId: string, updates: Record<string, unknown>): Promise<boolean> => {
      const result = await updateConstructionTask(buildingId, taskId, updates);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  const removeTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      const result = await deleteConstructionTask(buildingId, taskId);
      if (result.success) {
        await loadData();
      }
      return result.success;
    },
    [buildingId, loadData]
  );

  return {
    taskGroups,
    stats,
    phases,
    tasks,
    loading,
    error,
    isEmpty: !loading && phases.length === 0,
    dialogState,
    openCreatePhaseDialog,
    openEditPhaseDialog,
    openCreateTaskDialog,
    openEditTaskDialog,
    closeDialog,
    handleTaskUpdate,
    handleTaskClick,
    handleGroupClick,
    savePhase,
    updatePhase: updatePhaseHandler,
    removePhase,
    saveTask,
    updateTask: updateTaskHandler,
    removeTask,
    reload: loadData,
  };
}
