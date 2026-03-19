/**
 * ADR-244: Role Management Admin Console — Shared Types
 *
 * Types used across the role management page, components, and API endpoints.
 */

import type { GlobalRole } from '@/lib/auth/types';

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

export interface ChangeStatusResponse {
  success: true;
  data: {
    previousStatus: 'active' | 'suspended';
    newStatus: 'active' | 'suspended';
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
