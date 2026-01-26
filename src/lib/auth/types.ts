/**
 * @fileoverview Authorization Types - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Enterprise-grade authorization types following RFC v6 specification.
 * Provides compile-time safety for all permission-related operations.
 *
 * @see docs/rfc/authorization-rbac.md
 */

// =============================================================================
// GLOBAL ROLES (Coarse-grained, stored in Custom Claims)
// =============================================================================

/**
 * Global roles array - Single source of truth.
 * Used for validation and type derivation.
 */
export const GLOBAL_ROLES = [
  'super_admin',     // Break-glass, system-wide access
  'company_admin',   // Company management
  'internal_user',   // Internal staff
  'external_user',   // Customers, partners
] as const;

/**
 * Global roles determine company-wide access level.
 * Stored in Firebase Custom Claims for fast verification without Firestore reads.
 */
export type GlobalRole = typeof GLOBAL_ROLES[number];

// =============================================================================
// PROJECT ROLES (Fine-grained, stored in Firestore)
// =============================================================================

/**
 * Project roles determine per-project access level.
 * Stored in /projects/{projectId}/members/{uid}
 */
export type ProjectRole =
  | 'project_manager'
  | 'architect'
  | 'engineer'
  | 'site_manager'
  | 'accountant'
  | 'sales_agent'
  | 'data_entry'
  | 'viewer'
  | 'vendor';  // External suppliers

// =============================================================================
// PERMISSION REGISTRY (Compile-time Safety)
// =============================================================================

/**
 * Permission Registry - Single source of truth for all permissions.
 * Using `as const` ensures compile-time safety and autocomplete.
 *
 * Pattern: `domain:resource:action`
 *
 * @example
 * hasPermission(ctx, 'comm:conversations:list')
 */
export const PERMISSIONS = {
  // Communications
  'comm:conversations:list': true,
  'comm:conversations:view': true,
  'comm:conversations:update': true,
  'comm:messages:view': true,
  'comm:messages:send': true,

  // Projects
  'projects:projects:view': true,
  'projects:projects:create': true,
  'projects:projects:update': true,
  'projects:projects:delete': true,
  'projects:members:view': true,
  'projects:members:manage': true,
  'projects:floors:view': true,

  // Units
  'units:units:view': true,
  'units:units:update': true,

  // Buildings (Phase 2 - first vertical slice)
  'buildings:buildings:view': true,
  'buildings:buildings:create': true,
  'buildings:buildings:update': true,
  'buildings:buildings:delete': true,

  // DXF
  'dxf:files:view': true,
  'dxf:files:upload': true,
  'dxf:layers:view': true,
  'dxf:layers:manage': true,
  'dxf:annotations:edit': true,

  // CRM
  'crm:contacts:view': true,
  'crm:contacts:create': true,
  'crm:contacts:update': true,
  'crm:contacts:export': true,
  // CRM - Opportunities (ADR-029 Global Search v1 Phase 2)
  'crm:opportunities:view': true,
  'crm:opportunities:create': true,
  'crm:opportunities:update': true,
  // CRM - Communications (ADR-029 Global Search v1 Phase 2)
  'crm:communications:view': true,
  // CRM - Tasks (ADR-029 Global Search v1 Phase 2)
  'crm:tasks:view': true,
  'crm:tasks:create': true,
  'crm:tasks:update': true,

  // Notifications
  'notifications:notifications:view': true,

  // Finance
  'finance:invoices:view': true,
  'finance:invoices:update': true,
  'finance:invoices:approve': true,

  // Legal
  'legal:documents:view': true,
  'legal:ownership:view': true,
  'legal:ownership:manage': true,
  'legal:grants:view': true,
  'legal:grants:create': true,
  'legal:grants:revoke': true,
  'legal:contracts:view': true,

  // Listings
  'listings:listings:publish': true,

  // Users & Settings
  'users:users:view': true,
  'users:users:manage': true,
  'settings:settings:view': true,
  'settings:settings:manage': true,

  // Admin & System Operations
  'admin:migrations:execute': true,
  'admin:data:fix': true,              // Data correction operations (fix incorrect data)
  'admin:direct:operations': true,     // Direct database operations (bypass normal flows)
  'admin:debug:read': true,            // Debug utilities (read-only inspection)
  'admin:system:configure': true,      // System configuration (webhooks, integrations)

  // Audit
  'audit:data:view': true,

  // Reports
  'reports:reports:view': true,
  'reports:reports:create': true,

  // Search (Global Search v1)
  'search:global:execute': true,

  // Photos & Progress
  'photos:photos:upload': true,
  'progress:progress:update': true,

  // Floorplans
  'floorplans:floorplans:process': true,

  // Orders (for vendors)
  'orders:orders:view': true,
  'deliveries:deliveries:view': true,
  'specs:specs:view': true,
} as const;

/**
 * Permission ID derived from registry.
 * Provides compile-time safety - invalid permissions cause TypeScript errors.
 */
export type PermissionId = keyof typeof PERMISSIONS;

// =============================================================================
// GRANT SCOPES (For Unit Delegation)
// =============================================================================

/**
 * Grant Scopes Registry - Permissions that can be delegated to external users.
 * Used in /units/{unitId}/grants/{granteeUid}
 */
export const GRANT_SCOPES = {
  'unit:read_basic': true,
  'unit:docs:view_basic': true,
  'unit:dxf:view': true,
  'unit:status:view': true,
  'unit:messages:view': true,
  'legal:documents:view': true,
  'legal:contracts:view': true,
} as const;

/**
 * Grant Scope ID for unit-level delegation.
 */
export type GrantScope = keyof typeof GRANT_SCOPES;

// =============================================================================
// AUDIT TYPES
// =============================================================================

/**
 * Audit Actions Registry - All auditable actions in the system.
 */
export const AUDIT_ACTIONS = {
  'role_changed': true,
  'permission_granted': true,
  'permission_revoked': true,
  'grant_created': true,
  'grant_revoked': true,
  'access_denied': true,
  'claims_updated': true,
  'ownership_changed': true,
  'system_bootstrap': true,
  'migration_executed': true,
  // Communications domain events (Phase 1)
  'email_sent': true,
  'message_sent': true,
  // Admin operations (Phase 2)
  'data_fix_executed': true,        // Data correction operations (fix incorrect data)
  'direct_operation_executed': true, // Direct database operations (bypass normal flows)
  'system_configured': true,         // System configuration changes (webhooks, integrations)
  // Data access operations (AUTHZ Phase 2)
  'data_accessed': true,             // API data access events (read operations with tenant isolation)
  // Webhook operations (External integrations)
  'webhook_received': true,          // External webhook event received (SendGrid, Telegram, etc.)
} as const;

/**
 * Audit action type derived from registry.
 */
export type AuditAction = keyof typeof AUDIT_ACTIONS;

/**
 * Audit Target Types Registry.
 */
export const AUDIT_TARGET_TYPES = {
  'user': true,
  'project': true,
  'building': true,       // Building entities (AUTHZ Phase 2)
  'unit': true,
  'role': true,
  'grant': true,
  'api': true,
  'migration': true,
  'webhook': true,        // External webhook integrations
} as const;

/**
 * Audit target type derived from registry.
 */
export type AuditTargetType = keyof typeof AUDIT_TARGET_TYPES;

/**
 * Typed audit change value (NO any!).
 */
export interface AuditChangeValue {
  type: 'role' | 'permission' | 'grant' | 'status' | 'membership' | 'webhook';
  value: string | string[] | Record<string, unknown>;
}

/**
 * Audit metadata for context.
 */
export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  reason?: string;
}

/**
 * Complete audit log entry.
 */
export interface AuditLogEntry {
  companyId: string;  // RFC v6 P0-2: Required for tenant isolation
  action: AuditAction;
  actorId: string;
  targetId: string;
  targetType: AuditTargetType;
  previousValue: AuditChangeValue | null;
  newValue: AuditChangeValue | null;
  timestamp: Date;
  metadata: AuditMetadata;
}

// =============================================================================
// CUSTOM CLAIMS CONTRACT
// =============================================================================

/**
 * Firebase Custom Claims structure.
 * Used for coarse-grained authorization without Firestore reads.
 */
export interface CustomClaims {
  /** Tenant anchor - required for multi-tenant isolation */
  companyId: string;
  /** Coarse access level */
  globalRole: GlobalRole;
  /** MFA enrollment status (NOT session verification) */
  mfaEnrolled?: boolean;
  /** Email verification status */
  emailVerified?: boolean;
}

// =============================================================================
// AUTH CONTEXT (Request-Scoped)
// =============================================================================

/**
 * Authenticated request context.
 * Built from Firebase ID token verification.
 */
export interface AuthContext {
  uid: string;
  email: string;
  companyId: string;
  globalRole: GlobalRole;
  mfaEnrolled: boolean;
  isAuthenticated: true;
}

/**
 * Unauthenticated context with reason.
 */
export interface UnauthenticatedContext {
  isAuthenticated: false;
  reason: 'missing_token' | 'invalid_token' | 'missing_claims';
}

/**
 * Union type for request context.
 */
export type RequestContext = AuthContext | UnauthenticatedContext;

// =============================================================================
// PROJECT MEMBERSHIP
// =============================================================================

/**
 * Project member document structure.
 * Stored in /projects/{projectId}/members/{uid}
 */
export interface ProjectMember {
  /** Duplicated for Firestore rules efficiency */
  companyId: string;
  /** Duplicated for Firestore rules efficiency */
  projectId: string;
  /** Role ID reference */
  roleId: string;
  /** Additional permission set IDs */
  permissionSetIds: string[];
  /** Precomputed effective permissions (updated by backend) */
  effectivePermissions: PermissionId[];
  /** Audit fields */
  addedAt: Date;
  addedBy: string;
}

// =============================================================================
// UNIT OWNERSHIP & GRANTS
// =============================================================================

/**
 * Unit owner document structure.
 * Stored in /units/{unitId}/owners/{uid}
 */
export interface UnitOwner {
  /** Duplicated for rules validation */
  companyId: string;
  /** Duplicated for rules validation */
  projectId: string;
  /** Duplicated for rules validation */
  unitId: string;
  /** Audit fields */
  addedAt: Date;
  addedBy: string;
  notes?: string;
}

/**
 * Unit grant document structure.
 * Stored in /units/{unitId}/grants/{granteeUid}
 */
export interface UnitGrant {
  /** Duplicated for rules validation */
  companyId: string;
  /** Duplicated for rules validation */
  projectId: string;
  /** Duplicated for rules validation */
  unitId: string;
  /** Delegated scopes */
  scopes: GrantScope[];
  /** Required expiration */
  expiresAt: Date;
  /** Audit fields */
  createdAt: Date;
  createdBy: string;
  reason: string;
  /** Revocation (if revoked) */
  revokedAt?: Date;
  revokedBy?: string;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if context is authenticated.
 */
export function isAuthenticated(ctx: RequestContext): ctx is AuthContext {
  return ctx.isAuthenticated === true;
}

/**
 * Type guard to check if a string is a valid PermissionId.
 */
export function isValidPermission(permission: string): permission is PermissionId {
  return permission in PERMISSIONS;
}

/**
 * Type guard to check if a string is a valid GrantScope.
 */
export function isValidGrantScope(scope: string): scope is GrantScope {
  return scope in GRANT_SCOPES;
}

/**
 * Type guard to check if a string is a valid GlobalRole.
 * Uses centralized GLOBAL_ROLES constant.
 */
export function isValidGlobalRole(role: string): role is GlobalRole {
  return (GLOBAL_ROLES as readonly string[]).includes(role);
}
