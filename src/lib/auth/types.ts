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
  "dxf:layers:unlock": true, // ADR-344 Q8 — unlock locked layers to write
  "dxf:annotations:edit": true,
  // ADR-344 text engine — TEXT/MTEXT entity permissions
  "dxf:text:create": true,
  "dxf:text:edit": true,
  "dxf:text:delete": true,
  // ADR-344 Phase 8 — custom dictionary (company-scoped spell-check terms)
  "dxf:dictionary:view": true,
  "dxf:dictionary:manage": true,

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

  // BIM 3D Dimensions (ADR-366 Phase 9 / C.3) — manual 3D dimensions tool
  "bim_dimensions_3d:dimensions:create": true,
  "bim_dimensions_3d:dimensions:read": true,
  "bim_dimensions_3d:dimensions:update": true,
  "bim_dimensions_3d:dimensions:delete": true,

  // BIM Comments / Markup (ADR-366 Phase 9 / C.2) — typed comment markers
  "bim_comments:comments:create": true,
  "bim_comments:comments:read": true,
  "bim_comments:comments:update": true,
  "bim_comments:comments:delete": true,
  "bim_comments:comments:assign": true,
  "bim_comments:comments:archive": true,

  // BIM Animations (ADR-366 Phase 9 / C.1.a) — camera animation configs + render jobs
  "bim_animations:animations:create": true,
  "bim_animations:animations:read": true,
  "bim_animations:animations:update": true,
  "bim_animations:animations:delete": true,

  // BIM Performance Telemetry (ADR-366 §C.7.Q3) — super-admin read-only
  "bim_performance_telemetry:telemetry:read": true,

  // Asset Packs (ADR-655) — gated content libraries (2D entourage, textures, symbols…).
  // ΕΝΑ permission για ΟΛΑ τα packs — ΟΧΙ ένα ανά pack: το PermissionId είναι στατικό
  // (`keyof typeof PERMISSIONS`), άρα permission-ανά-pack θα απαιτούσε edit εδώ + σε roles.ts
  // + deploy για ΚΑΘΕ νέο πακέτο. Η ταυτότητα του pack ζει στα ΔΕΔΟΜΕΝΑ (registry +
  // company entitlements), όχι στον τύπο. Αυτό εδώ απαντά μόνο: «ποιος ΧΡΗΣΤΗΣ μέσα στην
  // εταιρεία επιτρέπεται να χρησιμοποιεί πακέτα περιεχομένου;»
  "asset_packs:packs:use": true,

  // BIM Performance Diagnostics Triage (ADR-366 §C.7.Q2) — super-admin only
  // (granted via isBypass; explicit entries kept for audit transparency)
  "performance_diagnostics:diagnostics:triage": true,
  "performance_diagnostics:diagnostics:update_status": true,
  "performance_diagnostics:diagnostics:assign": true,
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
// AUDIT TYPES → ./audit-types.ts (ADR-655: το types.ts έφτασε το όριο των 500 γραμμών, N.7.1)
// =============================================================================
// Re-export ⇒ κάθε υπάρχον import από @/lib/auth/types δουλεύει αμετάβλητο.
// Ο ΟΡΙΣΜΟΣ ζει σε ΕΝΑ σημείο: ./audit-types.ts.
export { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from './audit-types';
export type {
  AuditAction,
  AuditTargetType,
  AuditChangeValue,
  AuditMetadata,
  AuditLogEntry,
} from './audit-types';


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
  /**
   * ADR-354 entry point #6 — true when `companyId` was overridden by the
   * super-admin switcher header. Routes use this to scope admin endpoints
   * to the effective company instead of returning cross-tenant data.
   */
  superAdminOverride?: boolean;
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
