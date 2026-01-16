/**
 * @fileoverview Authorization Module - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Main entry point for the authorization module.
 * Re-exports all public APIs for convenient importing.
 *
 * @example
 * ```typescript
 * import {
 *   withAuth,
 *   hasPermission,
 *   logAuditEvent,
 *   type AuthContext,
 *   type PermissionId,
 * } from '@/lib/auth';
 * ```
 *
 * @see docs/rfc/authorization-rbac.md
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Core types
  GlobalRole,
  ProjectRole,
  PermissionId,
  GrantScope,
  AuditAction,
  AuditTargetType,

  // Context types
  AuthContext,
  UnauthenticatedContext,
  RequestContext,
  CustomClaims,

  // Document types
  ProjectMember,
  UnitOwner,
  UnitGrant,
  AuditLogEntry,
  AuditChangeValue,
  AuditMetadata,
} from './types';

// =============================================================================
// TYPE GUARDS
// =============================================================================

export {
  isAuthenticated,
  isValidPermission,
  isValidGrantScope,
  isValidGlobalRole,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

export {
  GLOBAL_ROLES,
  PERMISSIONS,
  GRANT_SCOPES,
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from './types';

// =============================================================================
// ROLES
// =============================================================================

export type { RoleDefinition } from './roles';

export {
  PREDEFINED_ROLES,
  getRole,
  getRolePermissions,
  isRoleBypass,
  getProjectRoles,
  getGlobalRoles,
  compareRoleLevels,
} from './roles';

// =============================================================================
// PERMISSION SETS
// =============================================================================

export type { PermissionSetDefinition } from './permission-sets';

export {
  PERMISSION_SETS,
  getPermissionSet,
  getPermissionSetPermissions,
  requiresMfaEnrollment,
  getAllPermissionSetIds,
  getMfaRequiredSets,
  computeEffectivePermissions,
} from './permission-sets';

// =============================================================================
// AUTH CONTEXT
// =============================================================================

export {
  buildRequestContext,
  createDevContext,
} from './auth-context';

// =============================================================================
// PERMISSIONS
// =============================================================================

export type {
  PermissionCheckOptions,
  PermissionCheckResult,
  PermissionDeniedReason,
  PermissionSource,
  PermissionCache,
} from './permissions';

export {
  createPermissionCache,
  checkPermission,
  hasPermission,
  requirePermission,
  hasAllPermissions,
  hasAnyPermission,
} from './permissions';

// =============================================================================
// MIDDLEWARE
// =============================================================================

export type {
  AuthenticatedHandler,
  WithAuthOptions,
} from './middleware';

export {
  withAuth,
  requirePermissions,
  withProjectAuth,
  extractToken,
  getAuthContext,
} from './middleware';

// =============================================================================
// AUDIT
// =============================================================================

export {
  logAuditEvent,
  logRoleChange,
  logPermissionGranted,
  logPermissionRevoked,
  logGrantCreated,
  logGrantRevoked,
  logAccessDenied,
  logClaimsUpdated,
  logOwnershipChanged,
  logSystemBootstrap,
  logMigrationExecuted,
  extractRequestMetadata,
} from './audit';
