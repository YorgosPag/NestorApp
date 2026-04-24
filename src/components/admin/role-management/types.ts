/**
 * ADR-244: Role Management Admin Console — Shared Types
 *
 * Types used across the role management page, components, and API endpoints.
 */

import type { GlobalRole, AuditAction, AuditTargetType, AuditChangeValue, AuditMetadata } from '@/lib/auth/types';

// =============================================================================
// USER TYPES
// =============================================================================

export interface CompanyUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  globalRole: GlobalRole;
  status: 'active' | 'suspended';
  mfaEnrolled: boolean;
  lastSignIn: string | null;
  projectCount: number;
  permissionSetIds: string[];
  projectMemberships: ProjectMembership[];
}

export interface ProjectMembership {
  projectId: string;
  projectName: string;
  roleId: string;
  permissionSetIds: string[];
}

// =============================================================================
// FILTER TYPES
// =============================================================================

export interface UserListFilters {
  search: string;
  globalRole: GlobalRole | 'all';
  status: 'all' | 'active' | 'suspended';
  sortBy: 'name' | 'email' | 'lastSignIn' | 'globalRole';
  sortOrder: 'asc' | 'desc';
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface UserListResponse {
  success: true;
  data: {
    users: CompanyUser[];
    total: number;
  };
}

export interface ChangeRoleResponse {
  success: true;
  data: {
    previousRole: GlobalRole;
    newRole: GlobalRole;
    requiresReLogin: true;
  };
}

export interface UpdatePermissionSetsResponse {
  success: true;
  data: {
    previousSets: string[];
    newSets: string[];
    added: string[];
    removed: string[];
  };
}

export interface BootstrapResponse {
  success: true;
  data: {
    created: number;
    skipped: number;
    total: number;
  };
}

// =============================================================================
// BADGE MAPPING
// =============================================================================

export type BadgeVariant = 'destructive' | 'default' | 'success' | 'secondary' | 'warning';

export const ROLE_BADGE_VARIANT: Record<GlobalRole, BadgeVariant> = {
  super_admin: 'destructive',
  company_admin: 'default',
  internal_user: 'success',
  external_user: 'secondary',
} as const;

export const STATUS_BADGE_VARIANT: Record<'active' | 'suspended', BadgeVariant> = {
  active: 'success',
  suspended: 'warning',
} as const;

// =============================================================================
// DIALOG MODES
// =============================================================================

export type DialogMode = 'role' | 'permissions' | 'detail' | 'suspend' | null;

// =============================================================================
// TAB TYPES
// =============================================================================

export type TabId = 'users' | 'roles' | 'audit' | 'projects';

// =============================================================================
// DEFAULT FILTERS
// =============================================================================

export const DEFAULT_FILTERS: UserListFilters = {
  search: '',
  globalRole: 'all',
  status: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
};

// =============================================================================
// AUDIT LOG TYPES (Phase B)
// =============================================================================

/**
 * Frontend representation of an audit log entry.
 * Fields are FLAT (actorId, targetId) matching the Firestore schema.
 * Display names are enriched separately from the users collection.
 */
export interface FrontendAuditEntry {
  id: string;
  action: AuditAction;
  actorId: string;
  actorDisplayName: string | null;
  targetId: string;
  targetDisplayName: string | null;
  targetType: AuditTargetType;
  previousValue: AuditChangeValue | null;
  newValue: AuditChangeValue | null;
  timestamp: string; // ISO string
  metadata: AuditMetadata;
}

export interface AuditLogFilters {
  dateFrom: string;
  dateTo: string;
  actorId: string;
  targetId: string;
  action: AuditAction | 'all';
}

export const DEFAULT_AUDIT_FILTERS: AuditLogFilters = {
  dateFrom: '',
  dateTo: '',
  actorId: '',
  targetId: '',
  action: 'all',
};

export interface AuditLogResponse {
  success: true;
  data: {
    entries: FrontendAuditEntry[];
    total: number;
    nextCursor: string | null;
  };
}

// =============================================================================
// PROJECT MEMBERS TYPES (Phase B)
// =============================================================================

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
}

export interface ProjectMemberEntry {
  uid: string;
  email: string;
  displayName: string | null;
  roleId: string;
  permissionSetIds: string[];
  addedAt: string | null;
  addedBy: string | null;
}

export interface ProjectMembersResponse {
  success: true;
  data: {
    members: ProjectMemberEntry[];
    total: number;
  };
}

// =============================================================================
// AUDIT ACTION DISPLAY CONFIG
// =============================================================================

export type AuditBadgeColor = 'default' | 'destructive' | 'success' | 'warning' | 'secondary';

export interface AuditActionConfig {
  label: string;
  color: AuditBadgeColor;
  icon: string;
}

export const AUDIT_ACTION_DISPLAY: Record<string, AuditActionConfig> = {
  role_changed: { label: 'Role Changed', color: 'warning', icon: '🔄' },
  permission_granted: { label: 'Permission Granted', color: 'success', icon: '✅' },
  permission_revoked: { label: 'Permission Revoked', color: 'destructive', icon: '❌' },
  user_suspended: { label: 'User Suspended', color: 'destructive', icon: '🚫' },
  user_activated: { label: 'User Activated', color: 'success', icon: '✅' },
  permission_set_granted: { label: 'Permission Set Granted', color: 'success', icon: '📋' },
  permission_set_revoked: { label: 'Permission Set Revoked', color: 'warning', icon: '📋' },
  member_added: { label: 'Member Added', color: 'success', icon: '➕' },
  member_removed: { label: 'Member Removed', color: 'destructive', icon: '➖' },
  member_updated: { label: 'Member Updated', color: 'warning', icon: '✏️' },
  claims_updated: { label: 'Claims Updated', color: 'secondary', icon: '🔑' },
  system_bootstrap: { label: 'System Bootstrap', color: 'secondary', icon: '⚙️' },
};
