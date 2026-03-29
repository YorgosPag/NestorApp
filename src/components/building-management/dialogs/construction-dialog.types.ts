/**
 * Construction Phase Dialog — Types & Constants
 *
 * Extracted from ConstructionPhaseDialog.tsx to comply with 500-line limit.
 */

import type {
  ConstructionPhase,
  ConstructionTask,
  ConstructionPhaseStatus,
  ConstructionTaskStatus,
} from '@/types/building/construction';

// ─── Dialog Mode ────────────────────────────────────────────────────────

export type DialogMode = 'createPhase' | 'editPhase' | 'createTask' | 'editTask';

// ─── Form Data Types ────────────────────────────────────────────────────

export interface PhaseFormData {
  name: string;
  code: string;
  status: ConstructionPhaseStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  progress: number;
  description: string;
}

export interface TaskFormData {
  phaseId: string;
  name: string;
  code: string;
  status: ConstructionTaskStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  progress: number;
  description: string;
}

// ─── Props ──────────────────────────────────────────────────────────────

export interface ConstructionPhaseDialogProps {
  open: boolean;
  mode: DialogMode;
  onClose: () => void;
  phase?: ConstructionPhase;
  task?: ConstructionTask;
  phaseId?: string;
  phases?: ConstructionPhase[];
  /** Building ID — needed for resource assignments (ADR-266 C4) */
  buildingId?: string;
  /** Available workers for resource assignment (ADR-266 C4) */
  workers?: WorkerOptionItem[];
  onSavePhase: (data: PhaseFormData) => Promise<boolean>;
  onUpdatePhase: (phaseId: string, updates: Record<string, unknown>) => Promise<boolean>;
  onDeletePhase: (phaseId: string) => Promise<boolean>;
  onSaveTask: (data: TaskFormData) => Promise<boolean>;
  onUpdateTask: (taskId: string, updates: Record<string, unknown>) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<boolean>;
}

/** Worker option for resource assignment (ADR-266 C4) */
export interface WorkerOptionItem {
  contactId: string;
  name: string;
  specialty?: string | null;
}

// ─── Status Options ─────────────────────────────────────────────────────

export const PHASE_STATUSES: ConstructionPhaseStatus[] = [
  'planning',
  'inProgress',
  'completed',
  'delayed',
  'blocked',
];

export const TASK_STATUSES: ConstructionTaskStatus[] = [
  'notStarted',
  'inProgress',
  'completed',
  'delayed',
  'blocked',
];
