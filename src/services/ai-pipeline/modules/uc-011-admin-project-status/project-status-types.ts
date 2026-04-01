/**
 * @fileoverview Types and constants for UC-011 Admin Project Status (ADR-145)
 */

// ============================================================================
// STATUS LABELS
// ============================================================================

export const STATUS_LABELS: Record<string, string> = {
  planning: 'Σχεδιασμός',
  in_progress: 'Σε εξέλιξη',
  completed: 'Ολοκληρωμένο',
  on_hold: 'Σε αναμονή',
  cancelled: 'Ακυρωμένο',
};

// ============================================================================
// TYPES
// ============================================================================

/** Lookup mode: single project vs multi-project search */
export type LookupMode = 'single' | 'list' | 'search';

export interface ProjectInfo {
  projectId: string;
  name: string;
  status: string | null;
  statusLabel: string | null;
  address: string | null;
  description: string | null;
  progress: number;
  updatedAt: string | null;
}

export interface PropertyStats {
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
}

export interface GanttBuildingDetail {
  buildingName: string;
  phaseCount: number;
}

export interface ProjectWithDetails {
  project: ProjectInfo;
  propertyStats: PropertyStats;
  hasGantt: boolean;
  buildingCount: number;
  ganttDetails: GanttBuildingDetail[];
}

export interface ProjectLookupData {
  mode: LookupMode;
  searchTerm: string;
  searchCriteria: string | null;
  companyId: string;
  singleProject: ProjectWithDetails | null;
  projects: ProjectWithDetails[];
}

export const EMPTY_STATS: PropertyStats = { total: 0, sold: 0, available: 0, reserved: 0, other: 0 };
