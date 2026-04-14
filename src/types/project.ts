// 🏢 ENTERPRISE: Multi-address support (ADR-167)
import type { ProjectAddress } from './project/addresses';
import type { LandownerEntry } from '@/types/ownership-table';
// ADR-287 — SSoT imports (χρειάζονται locally για use στο Project interface,
// επιπρόσθετα των κάτωθι `export type {X}` re-exports για backward-compat).
import type { ProjectStatus } from '@/constants/project-statuses';
import type { ProjectType } from '@/constants/project-types';

// ADR-287 — ProjectStatus SSoT: canonical union lives στο
// `src/constants/project-statuses.ts`. Re-exported εδώ για backward-compat.
export type { ProjectStatus };

// ADR-308 — Soft-delete mixin
import type { SoftDeletableFields } from '@/types/soft-deletable';

// ADR-287 — ProjectType SSoT: canonical union lives στο
// `src/constants/project-types.ts`. Re-exported εδώ για backward-compat.
export type { ProjectType };

/** 🏢 ENTERPRISE: Priority levels for project management */
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

/** 🏢 ENTERPRISE: Risk assessment levels */
export type ProjectRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 🏢 ENTERPRISE: Complexity levels for project estimation */
export type ProjectComplexity = 'simple' | 'moderate' | 'complex' | 'highly_complex';

export interface Project extends SoftDeletableFields {
  id: string;
  /** 🏢 ENTERPRISE: Human-readable project code (e.g., "PRJ-001") */
  projectCode?: string;
  name: string;
  title: string;
  status: ProjectStatus;
  company: string;
  companyId: string;
  /** 🏢 ADR-232: Business entity link (separate from tenant companyId) */
  linkedCompanyId?: string | null;
  /** 🏢 ADR-232: Denormalized company display name */
  linkedCompanyName?: string | null;

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
  buildingBlock?: string;
  protocolNumber?: string;
  licenseNumber?: string;
  /** Αρχή έκδοσης αδείας */
  issuingAuthority?: string;
  /** Ημερομηνία έκδοσης αδείας (ISO string) */
  issueDate?: string;

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

  // 👷 IKA/EFKA LABOR COMPLIANCE (ADR-090)
  /** EFKA declaration data — αναγγελία έργου στο e-ΕΦΚΑ */
  efkaDeclaration?: import('@/components/projects/ika/contracts').EfkaDeclarationData;

  /** ADR-244: Οικοπεδούχοι — SSoT, χρησιμοποιείται στο Bartex + πίνακα ποσοστών */
  landowners?: LandownerEntry[] | null;
  /** ADR-244: Ποσοστό αντιπαροχής (%) — αν ισχύει σενάριο αντιπαροχής */
  bartexPercentage?: number | null;
  /** ADR-244: Denormalized contact IDs for Firestore array-contains queries */
  landownerContactIds?: string[] | null;

}

/**
 * ProjectSummary — Subset of Project for list/grid views and detail tabs.
 * SSoT: Derived via Pick — κάθε νέο πεδίο στο Project αρκεί να προστεθεί στο Pick.
 *
 * Used by:
 * - /api/projects/list (API response type)
 * - useFirestoreProjects hook
 * - useFirestoreProjectsPaginated hook
 */
export type ProjectSummary = Pick<Project,
  | 'id' | 'name' | 'title' | 'status' | 'company' | 'companyId'
  | 'address' | 'city' | 'addresses'
  | 'progress' | 'totalValue' | 'totalArea'
  | 'landowners' | 'bartexPercentage' | 'landownerContactIds'
> & {
  /** ADR-232: Business entity link */
  linkedCompanyId: string | null;
  /** ISO string — always defined (empty string default) */
  startDate: string;
  /** ISO string — always defined (empty string default) */
  completionDate: string;
  /** Computed: fieldToISO(updatedAt || lastUpdate) */
  lastUpdate: string;
};

export interface ProjectCustomer {
  contactId: string;
  name: string;
  phone: string | null;
  /** Email address for customer communication */
  email?: string;
  propertiesCount: number;
}

export interface ProjectStats {
  totalProperties: number;
  soldProperties: number;
  totalSoldArea: number;
}


export type ProjectSortKey = 'name' | 'progress' | 'totalValue' | 'status' | 'area';

/**
 * 🏢 ENTERPRISE: Project update payload for Firestore operations
 * Follows contacts.service.ts pattern for type-safe updates
 */
export type ProjectUpdatePayload = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> & {
  updatedAt?: unknown; // FieldValue from Firestore
  /** Allow null to unlink company from project */
  companyId?: string | null;
  company?: string | null;
  /** 🏢 ADR-232: Business entity link */
  linkedCompanyId?: string | null;
  linkedCompanyName?: string | null;

};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    planning: 'Σχεδιασμός',
    in_progress: 'Σε εξέλιξη',
    completed: 'Ολοκληρωμένο',
    on_hold: 'Σε αναμονή',
    cancelled: 'Ακυρωμένο',
    deleted: 'Στον κάδο'
};
