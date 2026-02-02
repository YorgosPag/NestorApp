// 🏢 ENTERPRISE: Multi-address support (ADR-167)
import type { ProjectAddress } from './project/addresses';

export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

/** 🏢 ENTERPRISE: Project types for construction industry */
export type ProjectType = 'residential' | 'commercial' | 'industrial' | 'mixed' | 'infrastructure' | 'renovation';

/** 🏢 ENTERPRISE: Priority levels for project management */
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

/** 🏢 ENTERPRISE: Risk assessment levels */
export type ProjectRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 🏢 ENTERPRISE: Complexity levels for project estimation */
export type ProjectComplexity = 'simple' | 'moderate' | 'complex' | 'highly_complex';

export interface Project {
  id: string;
  /** 🏢 ENTERPRISE: Human-readable project code (e.g., "PRJ-001") */
  projectCode?: string;
  name: string;
  title: string;
  status: ProjectStatus;
  company: string;
  companyId: string;

  // 🏢 LEGACY: Backward compatibility (kept for migration)
  // Use addresses[] for new data, these for existing records
  address: string;
  city: string;

  // 🏢 ENTERPRISE: Multi-address system (ADR-167)
  /** Project addresses - supports multiple entrances, deliveries, etc. */
  addresses?: ProjectAddress[];

  progress: number;
  totalValue: number;
  startDate?: string;
  completionDate?: string;
  lastUpdate: string;
  totalArea: number;

  // 🏢 ENTERPRISE: Extended project fields for advanced filtering (2026-01-19)
  /** Project description for search and display */
  description?: string;
  /** Project location (city/region) for filtering */
  location?: string;
  /** Client/customer name */
  client?: string;
  /** Project type classification */
  type?: ProjectType;
  /** Project priority level */
  priority?: ProjectPriority;
  /** Risk assessment level */
  riskLevel?: ProjectRiskLevel;
  /** Project complexity level */
  complexity?: ProjectComplexity;
  /** Total budget in euros */
  budget?: number;
  /** Expected duration in months */
  duration?: number;
  /** Start year for year-based filtering */
  startYear?: number;
  /** Expected end date (ISO string) */
  endDate?: string;

  // 🏢 ENTERPRISE: Boolean feature flags for filtering
  /** Has all required permits */
  hasPermits?: boolean;
  /** Has secured financing */
  hasFinancing?: boolean;
  /** Ecological/green building project */
  isEcological?: boolean;
  /** Uses subcontractors */
  hasSubcontractors?: boolean;
  /** Project is currently active */
  isActive?: boolean;
  /** Has reported issues */
  hasIssues?: boolean;
}

export interface ProjectCustomer {
  contactId: string;
  name: string;
  phone: string | null;
  /** Email address for customer communication */
  email?: string;
  unitsCount: number;
}

export interface ProjectStats {
  totalUnits: number;
  soldUnits: number;
  totalSoldArea: number;
}


export type ProjectSortKey = 'name' | 'progress' | 'totalValue' | 'status' | 'area';

/**
 * 🏢 ENTERPRISE: Project update payload for Firestore operations
 * Follows contacts.service.ts pattern for type-safe updates
 */
export type ProjectUpdatePayload = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> & {
  updatedAt?: unknown; // FieldValue from Firestore
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    planning: 'Σχεδιασμός',
    in_progress: 'Σε εξέλιξη',
    completed: 'Ολοκληρωμένο',
    on_hold: 'Σε αναμονή',
    cancelled: 'Ακυρωμένο'
};
