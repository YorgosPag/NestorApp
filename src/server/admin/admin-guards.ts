import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';
import {
  isApiAccessAllowed,
  validateEnvironmentForOperation,
  getCurrentRuntimeEnvironment,
} from '@/config/environment-security-config';
import { getDevCompanyId } from '@/config/dev-environment';
import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import {
  getAdminFirestore,
  getAdminAuth,
} from '@/lib/firebaseAdmin';

/**
 * ENTERPRISE: Centralized Admin Guards Module
 *
 * Server-only module providing:
 * - Firebase Admin SDK initialization (Auth + Firestore)
 * - ID token verification with role claim gating
 * - Environment security enforcement (via centralized config)
 * - Structured audit logging
 * - Server-only collection names (zero hardcoded strings in routes)
 *
 * @serverOnly This module must only be used in server-side code (API routes)
 * @author Enterprise Architecture Team
 *
 * ARCHITECTURE UPDATE (2026-01-16):
 * - Migrated to centralized environment-security-config.ts
 * - Removed hardcoded ALLOWED_ENVIRONMENTS array
 * - Implements graduated security policies (development/staging/test/production)
 * - Enables production deployment με proper security controls
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

// ============================================================================
// CONSTANTS
// ============================================================================

const ADMIN_ROLES: AdminRole[] = ['admin', 'broker', 'builder', 'super_admin'];
const AUTHORIZATION_HEADER = 'authorization';

/**
 * 🔐 PR-1B: MFA ENFORCEMENT CONFIGURATION
 *
 * Roles that REQUIRE MFA enrollment for access.
 * Per Local_Protocol: mandatory MFA for broker/builder/admin.
 *
 * @since 2026-01-29 - Security Gate Phase 1 (PR-1B)
 */
const MFA_REQUIRED_ROLES: AdminRole[] = ['admin', 'broker', 'builder', 'super_admin'];

/**
 * Check if a role requires MFA enrollment
 */
function roleRequiresMfa(role: AdminRole): boolean {
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

// ============================================================================
// FIREBASE ADMIN — DELEGATED TO CANONICAL MODULE
// ============================================================================
// ADR-077: All Firebase Admin initialization is handled by src/lib/firebaseAdmin.ts
// This module re-exports for backward compatibility of existing consumers.
//
// getAdminFirestore() and getAdminAuth() are imported from '@/lib/firebaseAdmin'
// and re-exported below for any code that imports from this module.
// ============================================================================

export { getAdminFirestore } from '@/lib/firebaseAdmin';

// ============================================================================
// ENVIRONMENT GATING
// ============================================================================

/**
 * Check if current environment allows API access
 * @enterprise Uses centralized environment-security-config
 * @deprecated Use isApiAccessAllowed() from environment-security-config directly
 */
export function isAllowedEnvironment(): boolean {
  return isApiAccessAllowed();
}

/**
 * Assert environment allows operation, throws if not
 * @enterprise Uses centralized environment-security-config
 * @deprecated Use validateEnvironmentForOperation() from environment-security-config
 */
export function assertAllowedEnvironment(): void {
  const result = validateEnvironmentForOperation('API_ACCESS');
  if (!result.allowed) {
    throw new Error(
      `[ADMIN_GUARDS] ${result.reason || 'Operation not allowed in current environment'}`
    );
  }
}

// ============================================================================
// FIREBASE AUTH VERIFICATION
// ============================================================================

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get(AUTHORIZATION_HEADER);
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify Firebase ID token and extract claims
 * ADR-077: Uses canonical getAdminAuth() from firebaseAdmin.ts
 */
async function verifyIdToken(token: string): Promise<DecodedIdToken | null> {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.log('[ADMIN_GUARDS] Token verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Verify Firebase session cookie and extract claims.
 * Used for Server Component auth via __session cookie.
 * ADR-077: Uses canonical getAdminAuth() from firebaseAdmin.ts
 */
async function verifySessionCookieToken(sessionCookie: string): Promise<DecodedIdToken | null> {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifySessionCookie(sessionCookie, false);
    return decodedToken;
  } catch (error) {
    console.log('[ADMIN_GUARDS] Session cookie verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Check if decoded token has admin role claim
 * 🏢 ENTERPRISE: Email-based role checking (matches EnterpriseSecurityService)
 */
function hasAdminRole(decodedToken: DecodedIdToken): AdminRole | null {
  // Check custom claims for role - including super_admin
  const role = decodedToken.role as string | undefined;
  const globalRole = (decodedToken as Record<string, unknown>).globalRole as string | undefined;

  // Check globalRole first (preferred claim name)
  if (globalRole && ADMIN_ROLES.includes(globalRole as AdminRole)) {
    console.log(`🔐 [admin-guards] Role from globalRole claim: ${globalRole}`);
    return globalRole as AdminRole;
  }

  // Check role claim (legacy)
  if (role && ADMIN_ROLES.includes(role as AdminRole)) {
    console.log(`🔐 [admin-guards] Role from role claim: ${role}`);
    return role as AdminRole;
  }

  // Fallback: check if user has admin claim (legacy support)
  if (decodedToken.admin === true) {
    return 'admin';
  }

  // 🏢 ENTERPRISE: Email-based admin check (PRIMARY METHOD)
  // This matches the behavior of EnterpriseSecurityService.checkUserRole()
  const email = decodedToken.email;
  if (!email) {
    return null;
  }

  const envAdminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  if (envAdminEmails) {
    const adminEmails = envAdminEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.includes(email.toLowerCase())) {
      console.log(`🔐 [admin-guards] Admin access granted via email for: ${email}`);
      return 'admin';
    }
  }

  return null;
}

// ============================================================================
// MAIN AUTHENTICATION FUNCTION
// ============================================================================

/**
 * Require admin authentication for a request
 *
 * This function:
 * 1. Checks environment allowlist
 * 2. Extracts Bearer token from Authorization header
 * 3. Verifies token with Firebase Auth
 * 4. Checks for admin role in custom claims
 * 5. Returns AdminContext on success
 *
 * @param request - NextRequest object
 * @param operationId - Unique operation ID for audit trail
 * @returns AuthResult with success status and context or error
 *
 * @example
 * ```typescript
 * const authResult = await requireAdminContext(request, operationId);
 * if (!authResult.success) {
 *   return NextResponse.json({ error: authResult.error }, { status: 403 });
 * }
 * const { uid, role } = authResult.context!;
 * ```
 */
export async function requireAdminContext(
  request: NextRequest,
  operationId: string
): Promise<AuthResult> {
  const environment = getCurrentRuntimeEnvironment();

  // Gate 1: Environment check (uses centralized security config)
  const envValidation = validateEnvironmentForOperation('requireAdminContext');
  if (!envValidation.allowed) {
    return {
      success: false,
      error: envValidation.reason || `Operation not allowed in ${environment} environment`,
    };
  }

  // Gate 2: Extract token
  const token = extractBearerToken(request);

  // Development bypass (when no token and in development)
  if (!token && environment === 'development') {
    console.log('[ADMIN_GUARDS] Development mode: bypassing auth (no token provided)');
    return {
      success: true,
      context: {
        uid: 'dev-admin',
        email: 'dev@localhost',
        role: 'admin',
        operationId,
        environment,
        mfaEnrolled: true, // Dev bypass assumes MFA enrolled
      },
    };
  }

  if (!token) {
    return {
      success: false,
      error: 'Missing Authorization header with Bearer token',
    };
  }

  // Gate 3: Verify token
  const decodedToken = await verifyIdToken(token);
  if (!decodedToken) {
    return {
      success: false,
      error: 'Invalid or expired authentication token',
    };
  }

  // Gate 4: Check admin role
  const role = hasAdminRole(decodedToken);
  if (!role) {
    return {
      success: false,
      error: 'User does not have admin privileges',
    };
  }

  // Gate 5: MFA Enforcement (PR-1B)
  // 🔐 SECURITY: Mandatory MFA for broker/builder/admin roles
  const mfaEnrolled = decodedToken.mfaEnrolled === true;

  if (roleRequiresMfa(role) && !mfaEnrolled) {
    // Log MFA denial for audit
    console.log(`🔐 [ADMIN_GUARDS] MFA DENIED: User ${decodedToken.email} (${role}) - MFA not enrolled`);

    return {
      success: false,
      error: `MFA enrollment required for ${role} role. Please enable two-factor authentication.`,
    };
  }

  // Success - return admin context
  return {
    success: true,
    context: {
      uid: decodedToken.uid,
      email: decodedToken.email || 'unknown',
      role,
      operationId,
      environment,
      mfaEnrolled,
    },
  };
}

// ============================================================================
// USER AUTHENTICATION (NO ADMIN ROLE REQUIRED)
// ============================================================================

/**
 * Require user authentication for a request (no admin role required)
 *
 * This function:
 * 1. Checks environment allowlist
 * 2. Extracts Bearer token from Authorization header
 * 3. Verifies token with Firebase Auth
 * 4. Returns UserContext on success (does NOT require admin role)
 *
 * @param request - NextRequest object
 * @param operationId - Unique operation ID for audit trail
 * @returns UserAuthResult with success status and context or error
 *
 * @enterprise Use this for endpoints that require authenticated users but not admin privileges
 * @example
 * ```typescript
 * const authResult = await requireUserContext(request, operationId);
 * if (!authResult.success) {
 *   return NextResponse.json({ error: authResult.error }, { status: 401 });
 * }
 * const { uid, email } = authResult.context!;
 * ```
 */
export async function requireUserContext(
  request: NextRequest,
  operationId: string
): Promise<UserAuthResult> {
  const environment = getCurrentRuntimeEnvironment();

  // Gate 1: Environment check (uses centralized security config)
  const envValidation = validateEnvironmentForOperation('requireUserContext');
  if (!envValidation.allowed) {
    return {
      success: false,
      error: envValidation.reason || `Operation not allowed in ${environment} environment`,
    };
  }

  // Gate 2: Extract token (NO BYPASS - always require valid token)
  const token = extractBearerToken(request);

  if (!token) {
    return {
      success: false,
      error: 'Missing Authorization header with Bearer token',
    };
  }

  // Gate 3: Verify token
  const decodedToken = await verifyIdToken(token);
  if (!decodedToken) {
    return {
      success: false,
      error: 'Invalid or expired authentication token',
    };
  }

  // Success - return user context (role is optional, can be null)
  const role = hasAdminRole(decodedToken);

  return {
    success: true,
    context: {
      uid: decodedToken.uid,
      email: decodedToken.email || 'unknown',
      role, // Can be null if user has no admin role
      operationId,
      environment,
    },
  };
}

// ============================================================================
// STAFF AUTHENTICATION (ADMIN/BROKER/BUILDER ROLES REQUIRED)
// ============================================================================

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

/**
 * Require staff authentication for a request (admin/broker/builder roles)
 *
 * This is a thin wrapper around requireAdminContext that provides:
 * - Staff-specific error semantics (STAFF_REQUIRED)
 * - 403 status for denial (instead of generic auth errors)
 *
 * @param request - NextRequest object
 * @param operationId - Unique operation ID for audit trail
 * @returns StaffAuthResult with success status and context or error
 *
 * @enterprise EPIC Δ - Staff-only Inbox endpoints
 * @example
 * ```typescript
 * const authResult = await requireStaffContext(request, operationId);
 * if (!authResult.success) {
 *   throw new ApiError(403, authResult.error || 'Staff access required', 'STAFF_REQUIRED');
 * }
 * const { uid, role } = authResult.context!;
 * ```
 */
export async function requireStaffContext(
  request: NextRequest,
  operationId: string
): Promise<StaffAuthResult> {
  // Delegate to existing requireAdminContext (which checks admin/broker/builder roles)
  const adminResult = await requireAdminContext(request, operationId);

  if (!adminResult.success) {
    // Map error to staff-specific semantics
    const isRoleError = adminResult.error?.includes('admin privileges');
    return {
      success: false,
      error: isRoleError ? 'Staff access required' : adminResult.error,
    };
  }

  // Success - return staff context
  return {
    success: true,
    context: adminResult.context,
  };
}

// ============================================================================
// SERVER COMPONENT AUTHENTICATION (THIN WRAPPER)
// ============================================================================

/**
 * Require admin authentication for Server Components (Next.js App Router)
 *
 * Thin wrapper around requireAdminContext for use in Server Components.
 * Extracts token from cookies and performs same admin verification.
 *
 * @param operationId - Unique operation ID for audit trail
 * @returns AdminContext on success
 * @throws Error with specific message if authentication fails
 *
 * @enterprise Server Component only - uses cookies() from next/headers
 * @example
 * ```typescript
 * // In page.tsx (Server Component)
 * import { requireAdminForPage } from '@/server/admin/admin-guards';
 *
 * export default async function AdminPage() {
 *   try {
 *     const adminCtx = await requireAdminForPage('ADMIN_PAGE_ACCESS');
 *     return <AdminPageClient adminContext={adminCtx} />;
 *   } catch (error) {
 *     return <UnauthorizedView error={error.message} />;
 *   }
 * }
 * ```
 */
export async function requireAdminForPage(
  operationId: string
): Promise<AdminContext> {
  const environment = getCurrentRuntimeEnvironment();

  // Gate 1: Environment check
  const envValidation = validateEnvironmentForOperation('requireAdminForPage');
  if (!envValidation.allowed) {
    throw new Error(
      envValidation.reason || `Operation not allowed in ${environment} environment`
    );
  }

  // Gate 2: Extract token from cookies
  // Dynamic import to avoid client-side bundling
  const { cookies } = await import('next/headers');

  // Firebase Auth stores session token in __session cookie (production)
  // or in localStorage (development - client-side only)
  // ⚠️ Next.js 15: cookies() must be awaited
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_CONFIG.NAME)?.value;

  // Development bypass (when no token and in development)
  if (!sessionCookie && environment === 'development') {
    console.log('[ADMIN_GUARDS] Development mode: bypassing page auth (no session cookie)');
    return {
      uid: 'dev-admin',
      email: 'dev@localhost',
      role: 'admin',
      operationId,
      environment,
      mfaEnrolled: true,
      companyId: await getDevCompanyId(), // 🏢 ENTERPRISE: Dev tenant isolation (SSoT - dynamic Firestore lookup)
    };
  }

  if (!sessionCookie) {
    throw new Error('Not authenticated - no session cookie found');
  }

  // Gate 3: Verify token with Firebase Admin
  const decodedToken = await verifySessionCookieToken(sessionCookie);
  if (!decodedToken) {
    throw new Error('Invalid or expired authentication token');
  }

  // Gate 4: Check admin role
  const role = hasAdminRole(decodedToken);
  if (!role) {
    throw new Error('User does not have admin privileges');
  }

  // Gate 5: MFA Enforcement
  const mfaEnrolled = decodedToken.mfaEnrolled === true;

  if (roleRequiresMfa(role) && !mfaEnrolled) {
    console.log(`🔐 [ADMIN_GUARDS] MFA DENIED (Page): User ${decodedToken.email} (${role}) - MFA not enrolled`);
    throw new Error(`MFA enrollment required for ${role} role`);
  }

  // 🏢 ENTERPRISE: Extract companyId from Firebase Auth custom claims for tenant isolation
  const companyId = decodedToken.companyId as string | undefined;

  // Success - return admin context
  return {
    uid: decodedToken.uid,
    email: decodedToken.email || 'unknown',
    role,
    operationId,
    environment,
    mfaEnrolled,
    companyId, // 🏢 ENTERPRISE: Tenant-scoped admin context
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Create structured audit log entry
 *
 * @param operationId - Unique operation ID
 * @param operation - Operation name (e.g., 'SEED_BUILDINGS_START')
 * @param details - Additional details to log
 * @param context - Optional admin context for authenticated operations
 */
export function audit(
  operationId: string,
  operation: string,
  details: Record<string, unknown>,
  context?: AdminContext
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    operationId,
    operation,
    environment: context?.environment || process.env.NODE_ENV || 'unknown',
    uid: context?.uid,
    role: context?.role,
    details,
  };

  // Structured logging for parsing compatibility
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}
