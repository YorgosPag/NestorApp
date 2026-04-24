import 'server-only';

/**
 * 🔐 ENTERPRISE: Centralized Admin Guards Module
 *
 * Server-only module providing:
 * - Firebase Admin SDK initialization (Auth + Firestore)
 * - ID token verification with role claim gating
 * - Environment security enforcement (via centralized config)
 * - Structured audit logging
 * - Server-only collection names (zero hardcoded strings in routes)
 *
 * Split (ADR-065 Phase 5):
 * - admin-guards-types.ts      → Types, interfaces, constants
 * - admin-guards-page-auth.ts  → Server Component auth (requireAdminForPage)
 * - admin-guards.ts (this)     → API auth, verification, audit
 *
 * @serverOnly This module must only be used in server-side code (API routes)
 */

import type { DecodedIdToken } from 'firebase-admin/auth';
import type { NextRequest } from 'next/server';
import {
  validateEnvironmentForOperation,
  getCurrentRuntimeEnvironment,
} from '@/config/environment-security-config';
import {
  getAdminAuth,
} from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('AdminGuards');

// Re-export all types for backward compatibility
export type {
  AdminContext,
  UserContext,
  UserAuthResult,
  AdminRole,
  AuthResult,
  AuditEntry,
  StaffContext,
  StaffAuthResult,
  ServerCollectionKey,
} from './admin-guards-types';

export {
  ADMIN_ROLES,
  roleRequiresMfa,
  SERVER_COLLECTIONS,
} from './admin-guards-types';

// Re-export page auth for backward compatibility
export { requireAdminForPage } from './admin-guards-page-auth';

import type {
  AdminContext,
  AdminRole,
  AuthResult,
  AuditEntry,
  UserAuthResult,
  StaffAuthResult,
} from './admin-guards-types';

import { ADMIN_ROLES, roleRequiresMfa } from './admin-guards-types';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// FIREBASE ADMIN — DELEGATED TO CANONICAL MODULE
// ============================================================================
// ADR-077: All Firebase Admin initialization is handled by src/lib/firebaseAdmin.ts
export { getAdminFirestore } from '@/lib/firebaseAdmin';

// ============================================================================
// FIREBASE AUTH VERIFICATION
// ============================================================================

const AUTHORIZATION_HEADER = 'authorization';

/** Extract Bearer token from Authorization header */
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
    logger.info('[ADMIN_GUARDS] Token verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Verify Firebase session cookie and extract claims.
 * Used for Server Component auth via __session cookie.
 * Exported for use by admin-guards-page-auth.ts
 */
export async function verifySessionCookieToken(sessionCookie: string): Promise<DecodedIdToken | null> {
  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifySessionCookie(sessionCookie, false);
    return decodedToken;
  } catch (error) {
    logger.info('[ADMIN_GUARDS] Session cookie verification failed:', (error as Error).message);
    return null;
  }
}

/**
 * Check if decoded token has admin role claim
 * Exported for use by admin-guards-page-auth.ts
 * 🏢 ENTERPRISE: Email-based role checking (matches EnterpriseSecurityService)
 */
export function hasAdminRole(decodedToken: DecodedIdToken): AdminRole | null {
  const role = decodedToken.role as string | undefined;
  const globalRole = (decodedToken as Record<string, unknown>).globalRole as string | undefined;

  // Check globalRole first (preferred claim name)
  if (globalRole && ADMIN_ROLES.includes(globalRole as AdminRole)) {
    logger.info(`🔐 [admin-guards] Role from globalRole claim: ${globalRole}`);
    return globalRole as AdminRole;
  }

  // Check role claim (legacy)
  if (role && ADMIN_ROLES.includes(role as AdminRole)) {
    logger.info(`🔐 [admin-guards] Role from role claim: ${role}`);
    return role as AdminRole;
  }

  // Fallback: check if user has admin claim (legacy support)
  if (decodedToken.admin === true) {
    return 'admin';
  }

  // 🏢 ENTERPRISE: Email-based admin check (PRIMARY METHOD)
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
      logger.info(`🔐 [admin-guards] Admin access granted via email for: ${email}`);
      return 'admin';
    }
  }

  return null;
}

// ============================================================================
// MAIN AUTHENTICATION — requireAdminContext
// ============================================================================

/**
 * Require admin authentication for a request
 *
 * Gates: Environment → Token → Firebase verify → Admin role → MFA
 *
 * @param request - NextRequest object
 * @param operationId - Unique operation ID for audit trail
 * @returns AuthResult with success status and context or error
 */
export async function requireAdminContext(
  request: NextRequest,
  operationId: string
): Promise<AuthResult> {
  const environment = getCurrentRuntimeEnvironment();

  // Gate 1: Environment check
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
    logger.info('[ADMIN_GUARDS] Development mode: bypassing auth (no token provided)');
    return {
      success: true,
      context: {
        uid: 'dev-admin',
        email: 'dev@localhost',
        role: 'admin',
        operationId,
        environment,
        mfaEnrolled: true,
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
  const mfaEnrolled = decodedToken.mfaEnrolled === true;

  if (roleRequiresMfa(role) && !mfaEnrolled) {
    logger.info(`🔐 [ADMIN_GUARDS] MFA DENIED: User ${decodedToken.email} (${role}) - MFA not enrolled`);
    return {
      success: false,
      error: `MFA enrollment required for ${role} role. Please enable two-factor authentication.`,
    };
  }

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
// AUDIT LOGGING
// ============================================================================

/**
 * Create structured audit log entry
 */
export function audit(
  operationId: string,
  operation: string,
  details: Record<string, unknown>,
  context?: AdminContext
): void {
  const entry: AuditEntry = {
    timestamp: nowISO(),
    operationId,
    operation,
    environment: context?.environment || process.env.NODE_ENV || 'unknown',
    uid: context?.uid,
    role: context?.role,
    details,
  };

  logger.info(`[AUDIT] ${JSON.stringify(entry)}`);
}
