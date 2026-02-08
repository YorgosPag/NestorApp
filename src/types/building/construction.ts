/**
 * Construction Phases & Tasks — Type Definitions (ADR-034)
 *
 * Enterprise types for Gantt chart Firestore integration.
 * Top-level collections: construction_phases, construction_tasks
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

// ─── Status Types ────────────────────────────────────────────────────────

export type ConstructionPhaseStatus =
  | 'planning'
  | 'inProgress'
  | 'completed'
  | 'delayed'
  | 'blocked';

export type ConstructionTaskStatus =
  | 'notStarted'
  | 'inProgress'
  | 'completed'
  | 'delayed'
  | 'blocked';

// ─── Core Entities ───────────────────────────────────────────────────────

export interface ConstructionPhase {
  id: string;
  buildingId: string;
  companyId: string;
  name: string;
  code: string;                    // PH-001, PH-002, ...
  order: number;                   // Sort order within building
  status: ConstructionPhaseStatus;
  plannedStartDate: string;        // ISO 8601
  plannedEndDate: string;          // ISO 8601
  actualStartDate?: string;
  actualEndDate?: string;
  progress: number;                // 0-100
  barColor?: string;               // Custom hex color for Gantt bar (#RRGGBB)
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ConstructionTask {
  id: string;
  phaseId: string;
  buildingId: string;
  companyId: string;
  name: string;
  code: string;                    // TSK-001, TSK-002, ...
  order: number;                   // Sort order within phase
  status: ConstructionTaskStatus;
  plannedStartDate: string;        // ISO 8601
  plannedEndDate: string;          // ISO 8601
  actualStartDate?: string;
  actualEndDate?: string;
  progress: number;                // 0-100
  dependencies?: string[];         // Array of task IDs
  barColor?: string;               // Custom hex color for Gantt bar (#RRGGBB)
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

// ─── Payload Types (API Create/Update) ───────────────────────────────────

export interface ConstructionPhaseCreatePayload {
  name: string;
  code?: string;
  order?: number;
  status?: ConstructionPhaseStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  description?: string;
}

export interface ConstructionPhaseUpdatePayload {
  name?: string;
  code?: string;
  order?: number;
  status?: ConstructionPhaseStatus;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  progress?: number;
  barColor?: string;
  description?: string;
}

export interface ConstructionTaskCreatePayload {
  phaseId: string;
  name: string;
  code?: string;
  order?: number;
  status?: ConstructionTaskStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  dependencies?: string[];
  description?: string;
}

export interface ConstructionTaskUpdatePayload {
  name?: string;
  code?: string;
  order?: number;
  status?: ConstructionTaskStatus;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  progress?: number;
  barColor?: string;
  dependencies?: string[];
  description?: string;
}

// ─── API Response Types ──────────────────────────────────────────────────

export interface ConstructionDataResponse {
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
}
