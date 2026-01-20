/**
 * =============================================================================
 * 🏢 ENTERPRISE: Workspace Types
 * =============================================================================
 *
 * Multi-tenant workspace model για enterprise-grade isolation.
 * Based on ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ από ChatGPT.
 *
 * @module types/workspace
 * @enterprise ADR-032 - Workspace-based Multi-Tenancy
 *
 * Workspace Types:
 * - company: Μια εταιρεία
 * - office_directory: Κοινός κατάλογος γραφείου / shared συνεργάτες
 * - personal: Προσωπικός χώρος (optional)
 *
 * @example
 * ```typescript
 * const companyWorkspace: Workspace = {
 *   id: 'ws_company_001',
 *   type: 'company',
 *   displayName: 'N.X.Γ. ΠΑΓΩΝΗΣ & ΣΙΑ',
 *   companyId: 'company_123', // Link to actual company contact
 *   status: 'active',
 *   createdAt: '2026-01-20T00:00:00Z',
 *   createdBy: 'user_abc',
 * };
 * ```
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// WORKSPACE TYPES
// ============================================================================

/**
 * Workspace type enumeration
 */
export type WorkspaceType =
  | 'company'          // Μια εταιρεία
  | 'office_directory' // Κοινός κατάλογος (shared contacts/files)
  | 'personal';        // Προσωπικός χώρος (optional)

/**
 * Workspace status
 */
export type WorkspaceStatus = 'active' | 'archived' | 'suspended';

/**
 * 🏢 ENTERPRISE: Workspace Entity
 *
 * Represents a tenant/workspace boundary for multi-tenant isolation.
 * All data (Contacts, Files, Projects) MUST belong to a workspace.
 */
export interface Workspace {
  /** Unique workspace ID (e.g., 'ws_company_001', 'ws_office_dir') */
  id: string;

  /** Workspace type */
  type: WorkspaceType;

  /** Human-readable display name */
  displayName: string;

  /** Optional description */
  description?: string;

  /**
   * Reference to company contact (for type='company')
   * This is the companyId from contacts collection
   */
  companyId?: string;

  /** Workspace status */
  status: WorkspaceStatus;

  /** Workspace settings */
  settings?: WorkspaceSettings;

  /** Created timestamp */
  createdAt: string | Timestamp;

  /** Created by user ID */
  createdBy: string;

  /** Updated timestamp */
  updatedAt?: string | Timestamp;

  /** Updated by user ID */
  updatedBy?: string;

  /** Metadata for extensibility */
  metadata?: Record<string, unknown>;
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  /** Default file retention period (days) */
  fileRetentionDays?: number;

  /** Enable audit logging */
  enableAuditLog?: boolean;

  /** Custom branding */
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
  };
}

// ============================================================================
// FIRESTORE DOCUMENT STRUCTURE
// ============================================================================

/**
 * Workspace as stored in Firestore
 * (with Timestamp instead of string dates)
 */
export interface WorkspaceFirestoreDoc {
  id: string;
  type: WorkspaceType;
  displayName: string;
  description?: string;
  companyId?: string;
  status: WorkspaceStatus;
  settings?: WorkspaceSettings;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CREATE/UPDATE INPUT TYPES
// ============================================================================

/**
 * Input for creating a new workspace
 */
export interface CreateWorkspaceInput {
  type: WorkspaceType;
  displayName: string;
  description?: string;
  companyId?: string; // Required for type='company'
  createdBy: string;
  settings?: WorkspaceSettings;
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating a workspace
 */
export interface UpdateWorkspaceInput {
  displayName?: string;
  description?: string;
  status?: WorkspaceStatus;
  settings?: Partial<WorkspaceSettings>;
  updatedBy: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ACTIVE WORKSPACE CONTEXT
// ============================================================================

/**
 * Active workspace context (used in React Context)
 */
export interface ActiveWorkspaceContext {
  /** Currently active workspace (null if none selected) */
  activeWorkspace: Workspace | null;

  /** All workspaces accessible by current user */
  availableWorkspaces: Workspace[];

  /** Loading state */
  loading: boolean;

  /** Error state */
  error: Error | null;

  /** Switch to a different workspace */
  switchWorkspace: (workspaceId: string) => Promise<void>;

  /** Refresh workspaces list */
  refreshWorkspaces: () => Promise<void>;
}

// ============================================================================
// WORKSPACE MEMBERSHIP (for user access control)
// ============================================================================

/**
 * Workspace member role
 */
export type WorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Workspace membership
 * (Links a user to a workspace with a specific role)
 */
export interface WorkspaceMember {
  /** Member ID */
  id: string;

  /** Workspace ID */
  workspaceId: string;

  /** User ID */
  userId: string;

  /** User email (for display) */
  userEmail: string;

  /** User display name (for display) */
  userDisplayName?: string;

  /** Member role */
  role: WorkspaceMemberRole;

  /** Added timestamp */
  addedAt: string | Timestamp;

  /** Added by user ID */
  addedBy: string;

  /** Last active timestamp */
  lastActiveAt?: string | Timestamp;
}

/**
 * Workspace membership as stored in Firestore
 */
export interface WorkspaceMemberFirestoreDoc {
  id: string;
  workspaceId: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  role: WorkspaceMemberRole;
  addedAt: Timestamp;
  addedBy: string;
  lastActiveAt?: Timestamp;
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Query parameters for listing workspaces
 */
export interface ListWorkspacesParams {
  /** Filter by type */
  type?: WorkspaceType;

  /** Filter by status */
  status?: WorkspaceStatus;

  /** Filter by user ID (workspaces accessible by this user) */
  userId?: string;

  /** Limit results */
  limit?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default workspace settings
 */
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  fileRetentionDays: 365 * 7, // 7 years
  enableAuditLog: true,
};

/**
 * Special workspace IDs (well-known workspaces)
 */
export const SPECIAL_WORKSPACE_IDS = {
  /** Office Directory workspace (shared contacts/files) */
  OFFICE_DIRECTORY: 'ws_office_directory',
} as const;

/**
 * Workspace type display names (i18n keys)
 */
export const WORKSPACE_TYPE_LABELS: Record<WorkspaceType, string> = {
  company: 'workspace.type.company',
  office_directory: 'workspace.type.officeDirectory',
  personal: 'workspace.type.personal',
};
