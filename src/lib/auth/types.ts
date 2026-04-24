/**
 * Authorization Types - RFC v6 Implementation
 * @see docs/rfc/authorization-rbac.md
 */

// =============================================================================
// GLOBAL ROLES (Coarse-grained, stored in Custom Claims)
// =============================================================================

/** Global roles array - Single source of truth. */
export const GLOBAL_ROLES = [
  "super_admin", // Break-glass, system-wide access
  "company_admin", // Company management
  "internal_user", // Internal staff
  "external_user", // Customers, partners
] as const;

/**
 * Global roles — stored in Firebase Custom Claims.
 */
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

// =============================================================================
// PROJECT ROLES (Fine-grained, stored in Firestore)
// =============================================================================

/**
 * Project roles determine per-project access level.
 * Stored in /projects/{projectId}/members/{uid}
 */
export type ProjectRole =
  | "project_manager"
  | "architect"
  | "engineer"
  | "site_manager"
  | "accountant"
  | "sales_agent"
  | "data_entry"
  | "viewer"
  | "vendor"; // External suppliers

// =============================================================================
// PERMISSION REGISTRY (Compile-time Safety) — Pattern: domain:resource:action
// =============================================================================

export const PERMISSIONS = {
  // Communications
  "comm:conversations:list": true,
  "comm:conversations:view": true,
  "comm:conversations:update": true,
  "comm:messages:view": true,
  "comm:messages:send": true,
  "comm:messages:delete": true,

  // Projects
  "projects:projects:view": true,
  "projects:projects:create": true,
  "projects:projects:update": true,
  "projects:projects:delete": true,
  "projects:members:view": true,
  "projects:members:manage": true,
  "projects:floors:view": true,
  "projects:floors:delete": true,

  // Properties (ADR-269) + legacy unit aliases (parking/storage)
  "properties:properties:view": true, "properties:properties:create": true,
  "properties:properties:update": true, "properties:properties:delete": true,
  "units:units:view": true, "units:units:create": true,
  "units:units:update": true, "units:units:delete": true,

  // Buildings (Phase 2 - first vertical slice)
  "buildings:buildings:view": true,
  "buildings:buildings:create": true,
  "buildings:buildings:update": true,
  "buildings:buildings:delete": true,

  // DXF
  "dxf:files:view": true,
  "dxf:files:upload": true,
  "dxf:layers:view": true,
  "dxf:layers:manage": true,
  "dxf:annotations:edit": true,

  // CRM
  "crm:contacts:view": true,
  "crm:contacts:create": true,
  "crm:contacts:update": true,
  "crm:contacts:delete": true,
  "crm:contacts:export": true,
  // CRM - Opportunities (ADR-029 Global Search v1 Phase 2)
  "crm:opportunities:view": true,
  "crm:opportunities:create": true,
  "crm:opportunities:update": true,
  // CRM - Communications (ADR-029 Global Search v1 Phase 2)
  "crm:communications:view": true,
  // CRM - Tasks (ADR-029 Global Search v1 Phase 2)
  "crm:tasks:view": true,
  "crm:tasks:create": true,
  "crm:tasks:update": true,

  // Notifications
  "notifications:notifications:view": true,

  // Finance
  "finance:invoices:view": true,
  "finance:invoices:update": true,
  "finance:invoices:approve": true,

  // Legal
  "legal:documents:view": true,
  "legal:ownership:view": true,
  "legal:ownership:manage": true,
  "legal:grants:view": true,
  "legal:grants:create": true,
  "legal:grants:revoke": true,
  "legal:contracts:view": true,

  // Listings
  "listings:listings:publish": true,

  // Users & Settings
  "users:users:view": true,
  "users:users:manage": true,
  "settings:settings:view": true,
  "settings:settings:manage": true,

  // Admin access (legacy permission ID)
  admin_access: true,

  // Admin & System Operations
  "admin:migrations:execute": true,
  "admin:data:fix": true, // Data correction operations (fix incorrect data)
  "admin:direct:operations": true, // Direct database operations (bypass normal flows)
  "admin:debug:read": true, // Debug utilities (read-only inspection)
  "admin:system:configure": true, // System configuration (webhooks, integrations)
  "admin:backup:execute": true, // Backup & restore operations (ADR-313)

  // Reports
  "reports:reports:view": true,
  "reports:reports:create": true,

  // Search (Global Search v1)
  "search:global:execute": true,

  // Photos & Progress
  "photos:photos:upload": true,
  "progress:progress:update": true,

  // Floorplans
  "floorplans:floorplans:process": true,

  // Orders (for vendors)
  "orders:orders:view": true,
  "deliveries:deliveries:view": true,
  "specs:specs:view": true,
} as const;

/** Permission ID derived from registry. */
export type PermissionId = keyof typeof PERMISSIONS;

// =============================================================================
// GRANT SCOPES (For Property Delegation)
// =============================================================================

/** Grant Scopes — permissions delegated to external users via property grants. */
export const GRANT_SCOPES = {
  "unit:read_basic": true,
  "unit:docs:view_basic": true,
  "unit:dxf:view": true,
  "unit:status:view": true,
  "unit:messages:view": true,
  "legal:documents:view": true,
  "legal:contracts:view": true,
} as const;

/** Grant Scope ID for unit-level delegation. */
export type GrantScope = keyof typeof GRANT_SCOPES;

// =============================================================================
// AUDIT TYPES
// =============================================================================

/** Audit Actions Registry — all auditable actions. */
export const AUDIT_ACTIONS = {
  role_changed: true,
  permission_granted: true,
  permission_revoked: true,
  grant_created: true,
  grant_revoked: true,
  access_denied: true,
  claims_updated: true,
  ownership_changed: true,
  system_bootstrap: true,
  migration_executed: true,
  // Communications
  email_sent: true,
  message_sent: true,
  communication_created: true,
  communication_approved: true,
  communication_rejected: true,
  // Admin operations
  data_fix_executed: true,
  direct_operation_executed: true,
  system_configured: true,
  // Data access (AUTHZ Phase 2)
  data_accessed: true,
  data_created: true,
  data_updated: true,
  data_deleted: true,
  // Soft-delete lifecycle (ADR-281)
  soft_deleted: true,
  restored: true,
  // Webhooks
  webhook_received: true,
  // Role Management (ADR-244)
  user_suspended: true,
  user_activated: true,
  permission_set_granted: true,
  permission_set_revoked: true,
  // Project membership (ADR-244 Phase B)
  member_added: true,
  member_removed: true,
  member_updated: true,
  // Financial (ADR-255 SPEC-255E)
  financial_transition: true,
  // Procurement (ADR-267)
  "procurement.po.created": true,
  "procurement.po.approved": true,
  "procurement.po.ordered": true,
  "procurement.po.status_changed": true,
  "procurement.po.items_edited": true,
  "procurement.po.cancelled": true,
  "procurement.po.deleted": true,
  "procurement.po.delivery_recorded": true,
  "procurement.po.invoice_linked": true,
} as const;

/** Audit action type derived from registry. */
export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** Audit Target Types Registry. */
export const AUDIT_TARGET_TYPES = {
  user: true,
  project: true,
  building: true, // Building entities (AUTHZ Phase 2)
  unit: true, // Legacy — kept for backward compat (parking/storage audit)
  property: true, // ADR-269 rename
  storage: true, // Storage units (ADR-255 SPEC-255B)
  parking: true, // Parking spaces (ADR-255 SPEC-255B)
  opportunity: true, // CRM opportunities (ADR-255 SPEC-255B)
  cheque: true, // Financial cheques (ADR-255 SPEC-255E)
  loan: true, // Financial loans (ADR-255 SPEC-255E)
  // Financial (ADR-255 SPEC-255E)
  payment: true,
  invoice: true,
  journal_entry: true,
  expense_document: true,
  category: true,
  apy_certificate: true,
  commission: true,
  agreement: true,
  role: true,
  grant: true,
  api: true,
  migration: true,
  webhook: true,
  communication: true,
  purchase_order: true,
} as const;

/** Audit target type derived from registry. */
export type AuditTargetType = keyof typeof AUDIT_TARGET_TYPES;

/** Typed audit change value. */
export interface AuditChangeValue {
  type:
    | "role"
    | "permission"
    | "grant"
    | "status"
    | "membership"
    | "webhook"
    | "building_update"
    | "building_delete"
    | "project_create"
    | "communication_status"
    | "task_linked"
    | "project_member"
    | "financial_status";
  value: string | string[] | Record<string, unknown>;
}

/** Audit metadata for context. */
export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  reason?: string;
}

/** Complete audit log entry. */
export interface AuditLogEntry {
  companyId: string; // RFC v6 P0-2: Required for tenant isolation
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

/** Firebase Custom Claims structure. */
export interface CustomClaims {
  /** Tenant anchor - required for multi-tenant isolation */
  companyId: string;
  /** Coarse access level */
  globalRole: GlobalRole;
  /** MFA enrollment status (NOT session verification) */
  mfaEnrolled?: boolean;
  /** Email verification status */
  emailVerified?: boolean;
  /** Fine-grained permissions (optional) */
  permissions?: PermissionId[];
}

// =============================================================================
// AUTH CONTEXT (Request-Scoped)
// =============================================================================

/** Authenticated request context (from Firebase ID token). */
export interface AuthContext {
  uid: string;
  email: string;
  companyId: string;
  globalRole: GlobalRole;
  mfaEnrolled: boolean;
  isAuthenticated: true;
}

/** Unauthenticated context with reason. */
export interface UnauthenticatedContext {
  isAuthenticated: false;
  reason: "missing_token" | "invalid_token" | "missing_claims";
}

/** Union type for request context. */
export type RequestContext = AuthContext | UnauthenticatedContext;

// =============================================================================
// COMPANY MEMBERSHIP (ADR-244: Role Management — Source of Truth for RBAC)
// =============================================================================
// =============================================================================
// PROJECT MEMBERSHIP
// =============================================================================

/** Project member document (stored in /projects/{pid}/members/{uid}). */
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
// PROPERTY OWNERSHIP & GRANTS
// =============================================================================

/** Property owner document (stored in /properties/{pid}/owners/{uid}). */
export interface PropertyOwner {
  /** Duplicated for rules validation */
  companyId: string;
  /** Duplicated for rules validation */
  projectId: string;
  /** Duplicated for rules validation */
  propertyId: string;
  /** Audit fields */
  addedAt: Date;
  addedBy: string;
  notes?: string;
}

/** Property grant document (stored in /properties/{pid}/grants/{granteeUid}). */
export interface PropertyGrant {
  /** Duplicated for rules validation */
  companyId: string;
  /** Duplicated for rules validation */
  projectId: string;
  /** Duplicated for rules validation */
  propertyId: string;
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

/** Type guard — is context authenticated? */
export function isAuthenticated(ctx: RequestContext): ctx is AuthContext {
  return ctx.isAuthenticated === true;
}

/** Type guard — is string a valid PermissionId? */
export function isValidPermission(
  permission: string,
): permission is PermissionId {
  return permission in PERMISSIONS;
}

/** Type guard — is string a valid GrantScope? */
export function isValidGrantScope(scope: string): scope is GrantScope {
  return scope in GRANT_SCOPES;
}

/** Type guard — is string a valid GlobalRole? */
export function isValidGlobalRole(role: string): role is GlobalRole {
  return (GLOBAL_ROLES as readonly string[]).includes(role);
}
