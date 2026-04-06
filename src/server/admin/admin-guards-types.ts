import 'server-only';

/**
 * 🔐 ADMIN GUARDS — TYPES & CONSTANTS
 *
 * Extracted from admin-guards.ts (ADR-065 Phase 5)
 * Server-only types for authentication and authorization
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Admin context returned after successful authentication
 */
export interface AdminContext {
  uid: string;
  email: string;
  role: AdminRole;
  operationId: string;
  environment: string;
  mfaEnrolled: boolean;
  companyId?: string; // 🏢 ENTERPRISE: Tenant isolation - from Firebase Auth custom claims
}

/**
 * User context returned after successful authentication (no admin role required)
 * @enterprise Used for endpoints that require authenticated users but not admin privileges
 */
export interface UserContext {
  uid: string;
  email: string;
  role: AdminRole | null;
  operationId: string;
  environment: string;
}

/**
 * User authentication result
 */
export interface UserAuthResult {
  success: boolean;
  error?: string;
  context?: UserContext;
}

/**
 * Supported admin roles from Firebase custom claims
 */
export type AdminRole = 'admin' | 'broker' | 'builder' | 'super_admin';

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  context?: AdminContext;
}

/**
 * Audit log entry structure
 */
export interface AuditEntry {
  timestamp: string;
  operationId: string;
  operation: string;
  environment: string;
  uid?: string;
  role?: AdminRole;
  details: Record<string, unknown>;
}

/**
 * Staff context returned after successful authentication
 * @enterprise EPIC Δ - Staff-only Inbox endpoints
 */
export interface StaffContext {
  uid: string;
  email: string;
  role: AdminRole;
  operationId: string;
  environment: string;
}

/**
 * Staff authentication result
 */
export interface StaffAuthResult {
  success: boolean;
  error?: string;
  context?: StaffContext;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ADMIN_ROLES: AdminRole[] = ['admin', 'broker', 'builder', 'super_admin'];

/**
 * 🔐 PR-1B: MFA ENFORCEMENT CONFIGURATION
 * Roles that REQUIRE MFA enrollment for access.
 */
const MFA_REQUIRED_ROLES: AdminRole[] = ['admin', 'broker', 'builder', 'super_admin'];

/** Check if a role requires MFA enrollment */
export function roleRequiresMfa(role: AdminRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}

// ============================================================================
// SERVER-ONLY COLLECTIONS (ZERO HARDCODED STRINGS IN ROUTES)
// ============================================================================

/**
 * Server-only Firestore collection names
 * These collections should NEVER be imported in client code
 * Routes MUST use these constants instead of hardcoded strings
 */
export const SERVER_COLLECTIONS = {
  /** Admin building templates - source of truth for seed/populate */
  ADMIN_BUILDING_TEMPLATES: 'admin_building_templates',
  /** Buildings collection - main buildings data */
  BUILDINGS: 'buildings',
  /** Audit logs */
  AUDIT_LOGS: 'audit_logs',
} as const;

export type ServerCollectionKey = keyof typeof SERVER_COLLECTIONS;
