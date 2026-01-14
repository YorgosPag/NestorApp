/**
 * @fileoverview Permission Checker - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Server-side permission checker with request-scoped caching.
 * Handles global roles, project memberships, and unit grants.
 *
 * IMPORTANT: Uses request-scoped cache, NOT global Map (serverless-safe)
 *
 * @see docs/rfc/authorization-rbac.md
 */

import 'server-only';

import { getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

import type {
  AuthContext,
  PermissionId,
  ProjectMember,
  GrantScope,
  UnitGrant,
} from './types';
import { isValidPermission, isValidGrantScope } from './types';
import { isRoleBypass, getRolePermissions } from './roles';
import { getPermissionSetPermissions, requiresMfaEnrollment } from './permission-sets';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Permission check options.
 */
export interface PermissionCheckOptions {
  /** Project ID for project-scoped permissions */
  projectId?: string;
  /** Unit ID for unit-scoped grants */
  unitId?: string;
  /** Require MFA verification for this check */
  requireMfa?: boolean;
}

/**
 * Permission check result with details.
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason: PermissionDeniedReason | null;
  source?: PermissionSource;
}

/**
 * Why permission was denied.
 */
export type PermissionDeniedReason =
  | 'not_authenticated'
  | 'invalid_permission'
  | 'no_project_membership'
  | 'permission_not_in_role'
  | 'mfa_required'
  | 'grant_expired'
  | 'grant_not_found';

/**
 * Where permission was granted from.
 */
export type PermissionSource =
  | 'global_role_bypass'
  | 'project_role'
  | 'permission_set'
  | 'unit_grant';

/**
 * Request-scoped permission cache.
 * Pass this between checks in the same request to avoid duplicate Firestore reads.
 */
export interface PermissionCache {
  /** Cached project memberships by projectId */
  memberships: Map<string, ProjectMember | null>;
  /** Cached unit grants by unitId */
  grants: Map<string, UnitGrant | null>;
}

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Create a new request-scoped permission cache.
 * Call this once per request and pass to all permission checks.
 *
 * @returns Empty permission cache
 *
 * @example
 * ```typescript
 * const cache = createPermissionCache();
 * const hasView = await hasPermission(ctx, 'projects:projects:view', { projectId }, cache);
 * const hasUpdate = await hasPermission(ctx, 'projects:projects:update', { projectId }, cache);
 * ```
 */
export function createPermissionCache(): PermissionCache {
  return {
    memberships: new Map(),
    grants: new Map(),
  };
}

// =============================================================================
// FIRESTORE ACCESS
// =============================================================================

/**
 * Get Firestore instance.
 * Uses existing initialized app.
 */
function getDb(): Firestore | null {
  const apps = getApps();
  if (apps.length === 0) {
    return null;
  }
  return getFirestore(apps[0]);
}

// =============================================================================
// MEMBERSHIP LOOKUP
// =============================================================================

/**
 * Get project membership for a user.
 *
 * @param ctx - Auth context
 * @param projectId - Project ID
 * @param cache - Permission cache
 * @returns ProjectMember or null
 */
async function getProjectMembership(
  ctx: AuthContext,
  projectId: string,
  cache: PermissionCache
): Promise<ProjectMember | null> {
  const cacheKey = `${projectId}:${ctx.uid}`;

  // Check cache first
  if (cache.memberships.has(cacheKey)) {
    return cache.memberships.get(cacheKey) ?? null;
  }

  const db = getDb();
  if (!db) {
    cache.memberships.set(cacheKey, null);
    return null;
  }

  try {
    // Path: /companies/{companyId}/projects/{projectId}/members/{uid}
    const memberDoc = await db
      .collection('companies')
      .doc(ctx.companyId)
      .collection('projects')
      .doc(projectId)
      .collection('members')
      .doc(ctx.uid)
      .get();

    if (!memberDoc.exists) {
      cache.memberships.set(cacheKey, null);
      return null;
    }

    const membership = memberDoc.data() as ProjectMember;
    cache.memberships.set(cacheKey, membership);
    return membership;
  } catch (error) {
    console.error('[PERMISSIONS] Failed to get project membership:', error);
    cache.memberships.set(cacheKey, null);
    return null;
  }
}

// =============================================================================
// GRANT LOOKUP
// =============================================================================

/**
 * Get unit grant for a user.
 *
 * @param ctx - Auth context
 * @param unitId - Unit ID
 * @param cache - Permission cache
 * @returns UnitGrant or null
 */
async function getUnitGrant(
  ctx: AuthContext,
  unitId: string,
  cache: PermissionCache
): Promise<UnitGrant | null> {
  const cacheKey = `${unitId}:${ctx.uid}`;

  // Check cache first
  if (cache.grants.has(cacheKey)) {
    return cache.grants.get(cacheKey) ?? null;
  }

  const db = getDb();
  if (!db) {
    cache.grants.set(cacheKey, null);
    return null;
  }

  try {
    // Path: /companies/{companyId}/units/{unitId}/grants/{uid}
    const grantDoc = await db
      .collection('companies')
      .doc(ctx.companyId)
      .collection('units')
      .doc(unitId)
      .collection('grants')
      .doc(ctx.uid)
      .get();

    if (!grantDoc.exists) {
      cache.grants.set(cacheKey, null);
      return null;
    }

    const grant = grantDoc.data() as UnitGrant;
    cache.grants.set(cacheKey, grant);
    return grant;
  } catch (error) {
    console.error('[PERMISSIONS] Failed to get unit grant:', error);
    cache.grants.set(cacheKey, null);
    return null;
  }
}

// =============================================================================
// PERMISSION CHECKING
// =============================================================================

/**
 * Check if user has a specific permission.
 *
 * Check order:
 * 1. Global role bypass (super_admin)
 * 2. Project membership (if projectId provided)
 * 3. Unit grant (if unitId provided)
 *
 * @param ctx - Authenticated context
 * @param permission - Permission ID to check
 * @param options - Check options
 * @param cache - Permission cache (optional, created if not provided)
 * @returns Permission check result
 *
 * @example
 * ```typescript
 * const result = await checkPermission(ctx, 'projects:projects:view', { projectId: 'abc' });
 * if (!result.granted) {
 *   console.log('Denied:', result.reason);
 * }
 * ```
 */
export async function checkPermission(
  ctx: AuthContext,
  permission: PermissionId,
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<PermissionCheckResult> {
  // Validate permission ID
  if (!isValidPermission(permission)) {
    return { granted: false, reason: 'invalid_permission' };
  }

  // Check 1: Global role bypass (super_admin)
  if (isRoleBypass(ctx.globalRole)) {
    return { granted: true, reason: null, source: 'global_role_bypass' };
  }

  // Check 2: Project membership
  if (options.projectId) {
    const membership = await getProjectMembership(ctx, options.projectId, cache);

    if (membership) {
      // Check MFA requirement for permission sets
      for (const setId of membership.permissionSetIds) {
        if (requiresMfaEnrollment(setId) && !ctx.mfaEnrolled) {
          return { granted: false, reason: 'mfa_required' };
        }
      }

      // Check explicit MFA requirement
      if (options.requireMfa && !ctx.mfaEnrolled) {
        return { granted: false, reason: 'mfa_required' };
      }

      // Check if permission is in effective permissions (precomputed)
      if (membership.effectivePermissions.includes(permission)) {
        return { granted: true, reason: null, source: 'project_role' };
      }

      // Fallback: compute from role + permission sets
      const rolePermissions = getRolePermissions(membership.roleId);
      if (rolePermissions.includes(permission)) {
        return { granted: true, reason: null, source: 'project_role' };
      }

      for (const setId of membership.permissionSetIds) {
        const setPermissions = getPermissionSetPermissions(setId);
        if (setPermissions.includes(permission)) {
          return { granted: true, reason: null, source: 'permission_set' };
        }
      }

      return { granted: false, reason: 'permission_not_in_role' };
    }

    return { granted: false, reason: 'no_project_membership' };
  }

  // Check 3: Unit grant (for external users)
  if (options.unitId) {
    const grant = await getUnitGrant(ctx, options.unitId, cache);

    if (!grant) {
      return { granted: false, reason: 'grant_not_found' };
    }

    // Check if grant is expired
    const now = new Date();
    const expiresAt = grant.expiresAt instanceof Date
      ? grant.expiresAt
      : new Date(grant.expiresAt);

    if (expiresAt < now) {
      return { granted: false, reason: 'grant_expired' };
    }

    // Check if grant was revoked
    if (grant.revokedAt) {
      return { granted: false, reason: 'grant_expired' };
    }

    // Map permission to grant scope
    const grantScope = permissionToGrantScope(permission);
    if (grantScope && grant.scopes.includes(grantScope)) {
      return { granted: true, reason: null, source: 'unit_grant' };
    }

    return { granted: false, reason: 'permission_not_in_role' };
  }

  // No project or unit scope - check global role permissions
  const globalPermissions = getRolePermissions(ctx.globalRole);
  if (globalPermissions.includes(permission)) {
    return { granted: true, reason: null, source: 'project_role' };
  }

  return { granted: false, reason: 'permission_not_in_role' };
}

/**
 * Map permission ID to grant scope (for unit delegation).
 *
 * @param permission - Permission ID
 * @returns Grant scope or null
 */
function permissionToGrantScope(permission: PermissionId): GrantScope | null {
  // Map common permissions to grant scopes
  const mapping: Partial<Record<PermissionId, GrantScope>> = {
    'units:units:view': 'unit:read_basic',
    'legal:documents:view': 'legal:documents:view',
    'legal:contracts:view': 'legal:contracts:view',
    'dxf:files:view': 'unit:dxf:view',
    'comm:messages:view': 'unit:messages:view',
  };

  const scope = mapping[permission];
  return scope && isValidGrantScope(scope) ? scope : null;
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Check if user has a permission (simple boolean).
 *
 * @param ctx - Authenticated context
 * @param permission - Permission ID
 * @param options - Check options
 * @param cache - Permission cache
 * @returns True if granted
 *
 * @example
 * ```typescript
 * if (await hasPermission(ctx, 'projects:projects:update', { projectId })) {
 *   // Allow update
 * }
 * ```
 */
export async function hasPermission(
  ctx: AuthContext,
  permission: PermissionId,
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<boolean> {
  const result = await checkPermission(ctx, permission, options, cache);
  return result.granted;
}

/**
 * Require a permission, throw if denied.
 *
 * @param ctx - Authenticated context
 * @param permission - Permission ID
 * @param options - Check options
 * @param cache - Permission cache
 * @throws Error if permission denied
 *
 * @example
 * ```typescript
 * await requirePermission(ctx, 'projects:projects:delete', { projectId });
 * // If we get here, permission was granted
 * ```
 */
export async function requirePermission(
  ctx: AuthContext,
  permission: PermissionId,
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<void> {
  const result = await checkPermission(ctx, permission, options, cache);

  if (!result.granted) {
    const error = new Error(`Permission denied: ${permission} (${result.reason})`);
    error.name = 'PermissionDeniedError';
    throw error;
  }
}

/**
 * Check multiple permissions (all must be granted).
 *
 * @param ctx - Authenticated context
 * @param permissions - Permission IDs
 * @param options - Check options
 * @param cache - Permission cache
 * @returns True if all granted
 */
export async function hasAllPermissions(
  ctx: AuthContext,
  permissions: PermissionId[],
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<boolean> {
  for (const permission of permissions) {
    const result = await checkPermission(ctx, permission, options, cache);
    if (!result.granted) {
      return false;
    }
  }
  return true;
}

/**
 * Check multiple permissions (any must be granted).
 *
 * @param ctx - Authenticated context
 * @param permissions - Permission IDs
 * @param options - Check options
 * @param cache - Permission cache
 * @returns True if any granted
 */
export async function hasAnyPermission(
  ctx: AuthContext,
  permissions: PermissionId[],
  options: PermissionCheckOptions = {},
  cache: PermissionCache = createPermissionCache()
): Promise<boolean> {
  for (const permission of permissions) {
    const result = await checkPermission(ctx, permission, options, cache);
    if (result.granted) {
      return true;
    }
  }
  return false;
}
