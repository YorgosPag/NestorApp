/**
 * =============================================================================
 * ASSIGNMENT POLICY - ENTERPRISE CRM ROUTING
 * =============================================================================
 *
 * 🏢 ENTERPRISE: Policy-driven task assignment για omnichannel intake.
 * Enables tenant-specific routing rules με audit trail.
 *
 * @module types/assignment-policy
 * @enterprise DB-driven, tenant-scoped, auditable
 *
 * ARCHITECTURE:
 * - AssignmentPolicy = Container (per company/project)
 * - AssignmentRule = Individual routing rule (per intent type)
 * - Fallback: No match → needsTriage=true
 *
 * TIMESTAMPS: All timestamps are ISO 8601 datetime strings (NO Date objects)
 */

import type { IntentTypeValue } from '@/schemas/ai-analysis';

// ============================================================================
// ASSIGNMENT TARGET (User or Role)
// ============================================================================

/**
 * Assignment target type
 * @enterprise Supports direct user assignment ή role-based
 */
export type AssignmentTargetType = 'user' | 'role';

/**
 * Assignment target
 * @enterprise Who should be assigned the task
 */
export interface AssignmentTarget {
  /** Target type discriminator */
  type: AssignmentTargetType;

  /** User ID (if type='user') ή Role name (if type='role') */
  value: string;

  /** Display name για UI (e.g., "Γιώργος Παγώνης", "Μηχανικός") */
  displayName?: string;
}

// ============================================================================
// ASSIGNMENT RULE (Per Intent Type)
// ============================================================================

/**
 * Assignment rule για specific intent type
 * @enterprise RACI-style routing rule
 */
export interface AssignmentRule {
  /** Rule ID (unique within policy) */
  id: string;

  /** Intent type this rule applies to (from AI analysis schema SSoT) */
  intentType: IntentTypeValue;

  /** Default assignee για this intent */
  defaultAssignedTo: AssignmentTarget;

  /** Users/roles to notify (optional) */
  notifyTargets?: AssignmentTarget[];

  /** Minimum confidence threshold (0-1) για auto-assignment */
  minConfidence?: number;

  /** Optional constraints (for future filtering) */
  constraints?: {
    /** Apply rule only for specific projects */
    projectIds?: string[];
    /** Apply rule only for specific buildings */
    buildingIds?: string[];
    /** Apply rule only for specific categories */
    categories?: string[];
  };

  /** Whether rule is active */
  isActive: boolean;

  /** Rule priority (lower = higher priority) */
  priority?: number;
}

// ============================================================================
// ASSIGNMENT POLICY (Container)
// ============================================================================

/**
 * Assignment policy για company/project
 * @enterprise Container για routing rules με tenant isolation
 */
export interface AssignmentPolicy {
  /** Unique policy ID */
  id: string;

  /** Company ID (tenant isolation) */
  companyId: string;

  /** Optional project ID (null = company-wide policy) */
  projectId?: string | null;

  /** Policy name */
  name: string;

  /** Policy description */
  description?: string;

  /** Routing rules */
  rules: AssignmentRule[];

  /** Default triage settings */
  triageSettings: {
    /** Default confidence threshold για triage (0-1) */
    defaultMinConfidence: number;

    /** Default triage assignee (για manual review) */
    triageAssignedTo?: AssignmentTarget;

    /** Auto-create task με triage status ή skip task creation */
    autoCreateTriageTask: boolean;
  };

  /** Policy status */
  status: 'active' | 'inactive' | 'archived';

  /** Audit trail */
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;

  /** Version for optimistic locking */
  version?: number;
}

// ============================================================================
// POLICY RESOLUTION RESULT
// ============================================================================

/**
 * Result από policy resolution
 * @enterprise Output από AssignmentPolicyService.resolve()
 */
export interface PolicyResolutionResult {
  /** Whether a matching rule was found */
  matched: boolean;

  /** Matched rule (if any) */
  matchedRule?: AssignmentRule;

  /** Resolved assignee */
  assignedTo?: AssignmentTarget;

  /** Users/roles to notify */
  notifyTargets?: AssignmentTarget[];

  /** Whether task should go to triage */
  needsTriage: boolean;

  /** Triage reason (if needsTriage=true) */
  triageReason?: string;

  /** Applied policy ID */
  policyId?: string;
}

// ============================================================================
// INPUT TYPES (for creating policies)
// ============================================================================

/**
 * Input για creating assignment policy
 */
export interface CreateAssignmentPolicyInput {
  companyId: string;
  projectId?: string | null;
  name: string;
  description?: string;
  rules: Omit<AssignmentRule, 'id'>[];
  triageSettings: AssignmentPolicy['triageSettings'];
  createdBy: string;
}

/**
 * Input για updating assignment policy
 */
export interface UpdateAssignmentPolicyInput {
  name?: string;
  description?: string;
  rules?: AssignmentRule[];
  triageSettings?: AssignmentPolicy['triageSettings'];
  status?: AssignmentPolicy['status'];
  updatedBy: string;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

/**
 * Query parameters για fetching policies
 */
export interface AssignmentPolicyQuery {
  companyId: string;
  projectId?: string | null;
  status?: AssignmentPolicy['status'];
  includeInactive?: boolean;
}
