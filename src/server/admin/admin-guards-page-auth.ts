import 'server-only';

/**
 * 🔐 ADMIN GUARDS — SERVER COMPONENT (PAGE) AUTHENTICATION
 *
 * Extracted from admin-guards.ts (ADR-065 Phase 5)
 * Thin wrapper for Server Components (Next.js App Router)
 */

import {
  validateEnvironmentForOperation,
  getCurrentRuntimeEnvironment,
} from '@/config/environment-security-config';
import { getDevCompanyId } from '@/config/dev-environment';
import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import { createModuleLogger } from '@/lib/telemetry';
import type { AdminContext } from './admin-guards-types';
import { roleRequiresMfa } from './admin-guards-types';
import { verifySessionCookieToken, hasAdminRole } from './admin-guards';

const logger = createModuleLogger('AdminGuards');

// ============================================================================
// SERVER COMPONENT AUTHENTICATION
// ============================================================================

/**
 * Require admin authentication for Server Components (Next.js App Router)
 *
 * Extracts token from cookies and performs admin verification.
 *
 * @param operationId - Unique operation ID for audit trail
 * @returns AdminContext on success
 * @throws Error with specific message if authentication fails
 *
 * @enterprise Server Component only - uses cookies() from next/headers
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

  // Gate 2: Extract token from cookies (dynamic import to avoid client-side bundling)
  const { cookies } = await import('next/headers');

  // ⚠️ Next.js 15: cookies() must be awaited
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_CONFIG.NAME)?.value;

  // Development bypass (when no token and in development)
  if (!sessionCookie && environment === 'development') {
    logger.info('[ADMIN_GUARDS] Development mode: bypassing page auth (no session cookie)');
    return {
      uid: 'dev-admin',
      email: 'dev@localhost',
      role: 'admin',
      operationId,
      environment,
      mfaEnrolled: true,
      companyId: await getDevCompanyId(),
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
    logger.info(`🔐 [ADMIN_GUARDS] MFA DENIED (Page): User ${decodedToken.email} (${role}) - MFA not enrolled`);
    throw new Error(`MFA enrollment required for ${role} role`);
  }

  // 🏢 ENTERPRISE: Extract companyId from Firebase Auth custom claims for tenant isolation
  const companyId = decodedToken.companyId as string | undefined;

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || 'unknown',
    role,
    operationId,
    environment,
    mfaEnrolled,
    companyId,
  };
}
