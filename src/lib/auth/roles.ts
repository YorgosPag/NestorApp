/**
 * @fileoverview Predefined Roles - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Predefined role definitions with explicit permission arrays.
 * NO WILDCARDS - all permissions are explicitly listed for security.
 *
 * @see docs/rfc/authorization-rbac.md
 */

import type { PermissionId } from './types';

// =============================================================================
// ROLE DEFINITION INTERFACE
// =============================================================================

/**
 * Role definition structure.
 */
export interface RoleDefinition {
  /** Display name (Greek) */
  name: string;
  /** Description */
  description: string;
  /** Explicit permission list - NO wildcards */
  permissions: PermissionId[];
  /** Hierarchy level (lower = more access) */
  level: number;
  /** Whether this is a project-scoped role */
  isProjectRole: boolean;
  /** Whether this role bypasses permission checks (super_admin only) */
  isBypass?: boolean;
}

// =============================================================================
// PREDEFINED ROLES
// =============================================================================

/**
 * Predefined roles mapping.
 * Used for bootstrap and role assignment.
 *
 * @example
 * const role = PREDEFINED_ROLES['project_manager'];
 * console.log(role.permissions); // ['projects:projects:view', ...]
 */
export const PREDEFINED_ROLES: Record<string, RoleDefinition> = {
  // ===========================================================================
  // GLOBAL ROLES (Not project-scoped)
  // ===========================================================================

  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  super_admin: {
    name: 'auth.roles.superAdmin.name',
    description: 'auth.roles.superAdmin.description',
    permissions: [],  // Empty - handled via isBypass
    level: 0,
    isProjectRole: false,
    isBypass: true    // Bypasses all permission checks
  },

  company_admin: {
    name: 'auth.roles.companyAdmin.name',
    description: 'auth.roles.companyAdmin.description',
    permissions: [
      'users:users:view',
      'users:users:manage',
      'projects:projects:view',
      'projects:projects:create',
      'projects:projects:update',
      'projects:projects:delete',
      'projects:members:view',
      'projects:members:manage',
      'buildings:buildings:view',
      'settings:settings:view',
      'settings:settings:manage',
      'notifications:notifications:view',
      'audit:data:view',
    ],
    level: 1,
    isProjectRole: false
  },

  // ===========================================================================
  // PROJECT ROLES (Project-scoped)
  // ===========================================================================

  project_manager: {
    name: 'auth.roles.projectManager.name',
    description: 'auth.roles.projectManager.description',
    permissions: [
      'projects:projects:view',
      'projects:projects:update',
      'projects:members:view',
      'projects:members:manage',
      'projects:floors:view',
      'buildings:buildings:view',
      'units:units:view',
      'units:units:update',
      'dxf:files:view',
      'dxf:files:upload',
      'dxf:layers:view',
      'reports:reports:view',
      'reports:reports:create',
      'photos:photos:upload',
      'progress:progress:update',
      'notifications:notifications:view',
    ],
    level: 2,
    isProjectRole: true
  },

  architect: {
    name: 'auth.roles.architect.name',
    description: 'auth.roles.architect.description',
    permissions: [
      'dxf:files:view',
      'dxf:layers:view',
      'projects:floors:view',
      'units:units:view',
      'notifications:notifications:view',
    ],
    level: 3,
    isProjectRole: true
  },

  engineer: {
    name: 'auth.roles.engineer.name',
    description: 'auth.roles.engineer.description',
    permissions: [
      'dxf:files:view',
      'dxf:layers:view',
      'projects:floors:view',
      'units:units:view',
      'specs:specs:view',
      'notifications:notifications:view',
    ],
    level: 3,
    isProjectRole: true
  },

  site_manager: {
    name: 'auth.roles.siteManager.name',
    description: 'auth.roles.siteManager.description',
    permissions: [
      'photos:photos:upload',
      'progress:progress:update',
      'reports:reports:view',
      'reports:reports:create',
      'units:units:view',
      'notifications:notifications:view',
    ],
    level: 4,
    isProjectRole: true
  },

  accountant: {
    name: 'auth.roles.accountant.name',
    description: 'auth.roles.accountant.description',
    permissions: [
      'finance:invoices:view',
      'finance:invoices:update',
      'reports:reports:view',
      'notifications:notifications:view',
    ],
    level: 4,
    isProjectRole: true
  },

  sales_agent: {
    name: 'auth.roles.salesAgent.name',
    description: 'auth.roles.salesAgent.description',
    permissions: [
      'crm:contacts:view',
      'crm:contacts:create',
      'crm:contacts:update',
      'units:units:view',
      'comm:conversations:list',
      'comm:conversations:view',
      'comm:messages:view',
      'comm:messages:send',
      'notifications:notifications:view',
    ],
    level: 4,
    isProjectRole: true
  },

  data_entry: {
    name: 'auth.roles.dataEntry.name',
    description: 'auth.roles.dataEntry.description',
    permissions: [
      'projects:projects:view',
      'units:units:view',
      'crm:contacts:view',
      'crm:contacts:create',
      'notifications:notifications:view',
    ],
    level: 5,
    isProjectRole: true
  },

  vendor: {
    name: 'auth.roles.vendor.name',
    description: 'auth.roles.vendor.description',
    permissions: [
      'orders:orders:view',
      'deliveries:deliveries:view',
      'specs:specs:view',
      'notifications:notifications:view',
    ],
    level: 5,
    isProjectRole: true
  },

  viewer: {
    name: 'auth.roles.viewer.name',
    description: 'auth.roles.viewer.description',
    permissions: [
      'projects:projects:view',
      'projects:floors:view',
      'units:units:view',
      'dxf:files:view',
      'dxf:layers:view',
      'reports:reports:view',
    ],
    level: 6,
    isProjectRole: true
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get role definition by ID.
 *
 * @param roleId - Role identifier
 * @returns Role definition or undefined
 */
export function getRole(roleId: string): RoleDefinition | undefined {
  return PREDEFINED_ROLES[roleId];
}

/**
 * Get permissions for a role.
 *
 * @param roleId - Role identifier
 * @returns Permission array or empty array
 */
export function getRolePermissions(roleId: string): PermissionId[] {
  const role = PREDEFINED_ROLES[roleId];
  return role?.permissions ?? [];
}

/**
 * Check if a role is a bypass role (super_admin).
 *
 * @param roleId - Role identifier
 * @returns True if role bypasses permission checks
 */
export function isRoleBypass(roleId: string): boolean {
  const role = PREDEFINED_ROLES[roleId];
  return role?.isBypass === true;
}

/**
 * Get all project roles.
 *
 * @returns Array of project role IDs
 */
export function getProjectRoles(): string[] {
  return Object.entries(PREDEFINED_ROLES)
    .filter(([_, def]) => def.isProjectRole)
    .map(([id]) => id);
}

/**
 * Get all global roles.
 *
 * @returns Array of global role IDs
 */
export function getGlobalRoles(): string[] {
  return Object.entries(PREDEFINED_ROLES)
    .filter(([_, def]) => !def.isProjectRole)
    .map(([id]) => id);
}

/**
 * Compare role levels (for hierarchy checks).
 * Returns negative if role1 has higher access than role2.
 *
 * @param roleId1 - First role ID
 * @param roleId2 - Second role ID
 * @returns Comparison result
 */
export function compareRoleLevels(roleId1: string, roleId2: string): number {
  const level1 = PREDEFINED_ROLES[roleId1]?.level ?? Infinity;
  const level2 = PREDEFINED_ROLES[roleId2]?.level ?? Infinity;
  return level1 - level2;
}
