/**
 * @fileoverview Permission Sets - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Permission sets are add-on permission bundles that can be assigned
 * to users in addition to their base role.
 *
 * @see docs/rfc/authorization-rbac.md
 */

import type { PermissionId } from './types';

// =============================================================================
// PERMISSION SET DEFINITION
// =============================================================================

/**
 * Permission set definition structure.
 */
export interface PermissionSetDefinition {
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Permissions included in this set */
  permissions: PermissionId[];
  /** Whether MFA enrollment is required to use this set */
  requiresMfaEnrolled?: boolean;
}

// =============================================================================
// PREDEFINED PERMISSION SETS
// =============================================================================

/**
 * Predefined permission sets.
 * These can be assigned to project members as add-ons to their base role.
 *
 * @example
 * // Add DXF editing capability to a viewer
 * await assignPermissionSet(userId, projectId, 'dxf_editor');
 */
export const PERMISSION_SETS: Record<string, PermissionSetDefinition> = {
  dxf_editor: {
    name: 'DXF Editor',
    description: 'Full DXF editing capabilities',
    permissions: [
      'dxf:files:view',
      'dxf:files:upload',
      'dxf:layers:manage',
      'dxf:annotations:edit'
    ]
  },

  dxf_uploader: {
    name: 'DXF Upload Only',
    description: 'Upload DXF files without editing',
    permissions: [
      'dxf:files:upload'
    ]
  },

  finance_approver: {
    name: 'Finance Approver',
    description: 'Approve financial transactions',
    permissions: [
      'finance:invoices:view',
      'finance:invoices:approve'
    ],
    requiresMfaEnrolled: true  // Sensitive operation
  },

  legal_viewer: {
    name: 'Legal Viewer',
    description: 'View legal documents',
    permissions: [
      'legal:documents:view'
    ],
    requiresMfaEnrolled: true  // Sensitive data
  },

  legal_manager: {
    name: 'Legal Manager',
    description: 'Manage ownership and grants',
    permissions: [
      'legal:documents:view',
      'legal:ownership:view',
      'legal:ownership:manage',
      'legal:grants:view',
      'legal:grants:create',
      'legal:grants:revoke',
      'legal:contracts:view'
    ],
    requiresMfaEnrolled: true  // Sensitive operations
  },

  crm_exporter: {
    name: 'CRM Export',
    description: 'Export CRM contacts',
    permissions: [
      'crm:contacts:export'
    ]
  },

  comm_staff: {
    name: 'Communications Staff',
    description: 'Handle customer communications',
    permissions: [
      'comm:conversations:list',
      'comm:conversations:view',
      'comm:conversations:update',
      'comm:messages:view',
      'comm:messages:send'
    ]
  },

  listing_publisher: {
    name: 'Listing Publisher',
    description: 'Publish units to public listings',
    permissions: [
      'listings:listings:publish'
    ]
  },

  report_creator: {
    name: 'Report Creator',
    description: 'Create and view reports',
    permissions: [
      'reports:reports:view',
      'reports:reports:create'
    ]
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get permission set definition by ID.
 *
 * @param setId - Permission set identifier
 * @returns Permission set definition or undefined
 */
export function getPermissionSet(setId: string): PermissionSetDefinition | undefined {
  return PERMISSION_SETS[setId];
}

/**
 * Get permissions for a permission set.
 *
 * @param setId - Permission set identifier
 * @returns Permission array or empty array
 */
export function getPermissionSetPermissions(setId: string): PermissionId[] {
  const set = PERMISSION_SETS[setId];
  return set?.permissions ?? [];
}

/**
 * Check if a permission set requires MFA enrollment.
 *
 * @param setId - Permission set identifier
 * @returns True if MFA is required
 */
export function requiresMfaEnrollment(setId: string): boolean {
  const set = PERMISSION_SETS[setId];
  return set?.requiresMfaEnrolled === true;
}

/**
 * Get all permission set IDs.
 *
 * @returns Array of permission set IDs
 */
export function getAllPermissionSetIds(): string[] {
  return Object.keys(PERMISSION_SETS);
}

/**
 * Get permission sets that require MFA.
 *
 * @returns Array of MFA-required permission set IDs
 */
export function getMfaRequiredSets(): string[] {
  return Object.entries(PERMISSION_SETS)
    .filter(([_, def]) => def.requiresMfaEnrolled)
    .map(([id]) => id);
}

/**
 * Compute effective permissions from multiple permission sets.
 *
 * @param setIds - Array of permission set IDs
 * @returns Deduplicated permission array
 */
export function computeEffectivePermissions(setIds: string[]): PermissionId[] {
  const permissionSet = new Set<PermissionId>();

  for (const setId of setIds) {
    const permissions = getPermissionSetPermissions(setId);
    for (const permission of permissions) {
      permissionSet.add(permission);
    }
  }

  return Array.from(permissionSet);
}
