/**
 * Building Milestones — Type Definitions
 *
 * Enterprise types for building milestone CRUD.
 * Top-level collection: building_milestones
 *
 * Pattern follows: src/types/building/construction.ts
 */

// ─── Status & Type Enums ────────────────────────────────────────────────

export type MilestoneStatus = 'completed' | 'in-progress' | 'pending' | 'delayed';

export type MilestoneType = 'start' | 'construction' | 'systems' | 'finishing' | 'delivery';

// ─── Core Entity ────────────────────────────────────────────────────────

export interface BuildingMilestone {
  id: string;
  buildingId: string;
  companyId: string;
  title: string;
  description: string;
  date: string;                   // ISO 8601
  status: MilestoneStatus;
  progress: number;               // 0-100
  type: MilestoneType;
  order: number;                  // Sort order within building
  code: string;                   // MS-001, MS-002, ...
  phaseId?: string;               // Optional link to construction phase
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

// ─── Payload Types (API Create/Update) ──────────────────────────────────

export interface MilestoneCreatePayload {
  title: string;
  description?: string;
  date: string;
  status?: MilestoneStatus;
  progress?: number;
  type: MilestoneType;
  order?: number;
  code?: string;
  phaseId?: string;
}

export interface MilestoneUpdatePayload {
  title?: string;
  description?: string;
  date?: string;
  status?: MilestoneStatus;
  progress?: number;
  type?: MilestoneType;
  order?: number;
  phaseId?: string | null;
}
