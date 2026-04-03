import type { Task, TaskGroup } from 'react-modern-gantt';
import type {
  ConstructionPhase,
  ConstructionPhaseCreatePayload,
  ConstructionPhaseStatus,
  ConstructionTask,
  ConstructionTaskCreatePayload,
  ConstructionTaskStatus,
} from '@/types/building/construction';
import type { GanttSummaryStats, GanttTaskStatus } from '../../tabs/TimelineTabContent/gantt/gantt-mock-data';

export interface DialogState {
  open: boolean;
  mode: 'createPhase' | 'editPhase' | 'createTask' | 'editTask';
  phase?: ConstructionPhase;
  task?: ConstructionTask;
  phaseId?: string;
}

export interface UseConstructionGanttReturn {
  taskGroups: TaskGroup[];
  stats: GanttSummaryStats;
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  dialogState: DialogState;
  openCreatePhaseDialog: () => void;
  openEditPhaseDialog: (phase: ConstructionPhase) => void;
  openCreateTaskDialog: (phaseId: string) => void;
  openEditTaskDialog: (task: ConstructionTask) => void;
  closeDialog: () => void;
  handleTaskUpdate: (groupId: string, updatedTask: Task) => void;
  handleTaskClick: (task: Task, group: TaskGroup) => void;
  handleTaskDoubleClick: (task: Task) => void;
  handleGroupClick: (group: TaskGroup) => void;
  savePhase: (data: ConstructionPhaseCreatePayload) => Promise<boolean>;
  updatePhase: (phaseId: string, updates: Record<string, unknown>) => Promise<boolean>;
  removePhase: (phaseId: string) => Promise<boolean>;
  saveTask: (data: ConstructionTaskCreatePayload) => Promise<boolean>;
  updateTask: (taskId: string, updates: Record<string, unknown>) => Promise<boolean>;
  removeTask: (taskId: string) => Promise<boolean>;
  updateBarColor: (id: string, isPhase: boolean, color: string) => Promise<void>;
  reload: () => Promise<void>;
}

export const GANTT_STATUS_COLORS: Record<GanttTaskStatus, string> = {
  completed: 'hsl(var(--status-success))',
  inProgress: 'hsl(var(--status-info))',
  notStarted: 'hsl(var(--muted-foreground))',
  delayed: 'hsl(var(--status-error))',
  blocked: 'hsl(var(--status-warning))',
};

export function mapTaskStatusToGantt(status: ConstructionTaskStatus): GanttTaskStatus {
  switch (status) {
    case 'completed': return 'completed';
    case 'inProgress': return 'inProgress';
    case 'notStarted': return 'notStarted';
    case 'delayed': return 'delayed';
    case 'blocked': return 'blocked';
    default: return 'notStarted';
  }
}

export function mapPhaseStatusToGantt(status: ConstructionPhaseStatus): GanttTaskStatus {
  switch (status) {
    case 'completed': return 'completed';
    case 'inProgress': return 'inProgress';
    case 'planning': return 'notStarted';
    case 'delayed': return 'delayed';
    case 'blocked': return 'blocked';
    default: return 'notStarted';
  }
}

export function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }

  return new Date(`${dateStr}T00:00:00`);
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
