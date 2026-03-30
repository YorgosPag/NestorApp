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

// ─── Delay Reason (SSoT — ADR-266 Phase C) ─────────────────────────────

/** Single source of truth for delay/block reason categories.
 *  Runtime-iterable + compile-time typed. Add new reasons HERE only. */
export const DELAY_REASONS = [
  'weather',
  'materials',
  'permits',
  'subcontractor',
  'other',
] as const;

export type DelayReason = (typeof DELAY_REASONS)[number];

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
  /** Reason for delay/block — set when status is 'delayed' or 'blocked', null otherwise */
  delayReason?: DelayReason | null;
  /** Free-text notes about the delay/block */
  delayNote?: string | null;
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
  /** Reason for delay/block — set when status is 'delayed' or 'blocked', null otherwise */
  delayReason?: DelayReason | null;
  /** Free-text notes about the delay/block */
  delayNote?: string | null;
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
  delayReason?: DelayReason | null;
  delayNote?: string | null;
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
  delayReason?: DelayReason | null;
  delayNote?: string | null;
}

// ─── Baseline Snapshot Types (ADR-266 Phase C, Sub-phase 3) ─────────────

/** Full snapshot of a schedule at a point in time — for Baseline vs Actual comparison */
export interface ConstructionBaseline {
  id: string;                          // cbase_uuid
  buildingId: string;
  companyId: string;
  name: string;                        // "Baseline 1 - Initial Schedule"
  version: number;                     // Auto-incremented per building (1, 2, 3…)
  description?: string | null;
  phases: ConstructionPhase[];         // Denormalized full copy at snapshot time
  tasks: ConstructionTask[];           // Denormalized full copy at snapshot time
  createdAt?: string;                  // ISO 8601
  createdBy?: string;                  // uid
}

/** Lightweight summary for list views (no embedded phases/tasks) */
export interface ConstructionBaselineSummary {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  phaseCount: number;
  taskCount: number;
}

export interface ConstructionBaselineCreatePayload {
  name: string;
  description?: string;
}

// ─── Resource Allocation Types (ADR-266 Phase C, Sub-phase 4) ──────────

export type ResourceType = 'worker' | 'equipment';

/** Resource assigned to a construction task — stored in construction_resource_assignments */
export interface ConstructionResourceAssignment {
  id: string;                          // crasn_uuid
  taskId: string;                      // → construction_tasks
  phaseId: string;                     // Denormalized for histogram queries
  buildingId: string;
  companyId: string;
  resourceType: ResourceType;
  /** Contact ID — only for 'worker' type */
  contactId?: string | null;
  /** Display name (worker full name or equipment label) */
  resourceName: string;
  /** Free-text label for equipment (e.g. "Crane #2") */
  equipmentLabel?: string | null;
  /** Total hours allocated to this task */
  allocatedHours: number;
  /** Actual hours worked — for utilization tracking (ADR-268 Phase 6a, Gap G3+G7) */
  actualHours?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

/** Lightweight summary for list views */
export interface ResourceAssignmentSummary {
  id: string;
  taskId: string;
  resourceType: ResourceType;
  resourceName: string;
  allocatedHours: number;
}

export interface ResourceAssignmentCreatePayload {
  taskId: string;
  phaseId: string;
  resourceType: ResourceType;
  contactId?: string;
  resourceName: string;
  equipmentLabel?: string;
  allocatedHours: number;
  notes?: string;
}

export interface ResourceAssignmentUpdatePayload {
  allocatedHours?: number;
  notes?: string | null;
}

// ─── API Response Types ──────────────────────────────────────────────────

export interface ConstructionDataResponse {
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
}
