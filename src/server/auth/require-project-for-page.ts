import 'server-only';

/**
 * 🔐 PAGE AUTH — TENANT-SCOPED PROJECT GUARD
 *
 * Server Component helper that authenticates the user via session cookie and
 * verifies that `projectId` belongs to the user's tenant. Throws on any
 * failure — caller is expected to render `notFound()` or a denial UI.
 *
 * @module server/auth/require-project-for-page
 * @enterprise ADR-330 — Procurement Hub Scoped Split (Phase 1 / Session S1)
 * @see ADR-326 — Tenant Org Structure
 * @see src/lib/auth/tenant-isolation.ts (requireProjectInTenant SSoT)
 */

import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import { getDevCompanyId } from '@/config/dev-environment';
import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { verifySessionCookieToken } from '@/server/admin/admin-guards';
import { requireProjectInTenant, TenantIsolationError, type TenantProject } from '@/lib/auth/tenant-isolation';
import { isValidGlobalRole, type GlobalRole, type AuthContext } from '@/lib/auth/types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('RequireProjectForPage');

export interface RequireProjectForPageResult {
  ctx: AuthContext;
  project: TenantProject;
}

export async function requireProjectForPage(
  projectId: string,
  path: string,
): Promise<RequireProjectForPageResult> {
  const environment = getCurrentRuntimeEnvironment();
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_CONFIG.NAME)?.value;

  let ctx: AuthContext;

  if (!sessionCookie && environment === 'development') {
    logger.info('[REQUIRE_PROJECT_FOR_PAGE] Dev bypass — no session cookie');
    ctx = {
      uid: 'dev-user',
      email: 'dev@localhost',
      companyId: await getDevCompanyId(),
      globalRole: 'company_admin',
      mfaEnrolled: false,
      isAuthenticated: true,
    };
  } else {
    if (!sessionCookie) {
      throw new TenantIsolationError('Not authenticated', 403, 'FORBIDDEN');
    }

    const decoded = await verifySessionCookieToken(sessionCookie);
    if (!decoded) {
      throw new TenantIsolationError('Invalid or expired session', 403, 'FORBIDDEN');
    }

    // ADR-657 §3.5 — FAIL CLOSED. No env-var companyId fallback, no default
    // 'company_admin' role: a session cookie without RFC-v6 claims is denied,
    // not silently promoted to a default tenant + admin.
    const companyId = decoded.companyId as string | undefined;
    if (typeof companyId !== 'string' || companyId.length === 0) {
      throw new TenantIsolationError('Missing companyId claim', 403, 'FORBIDDEN');
    }

    const globalRoleRaw = decoded.globalRole as string | undefined;
    if (typeof globalRoleRaw !== 'string' || !isValidGlobalRole(globalRoleRaw)) {
      throw new TenantIsolationError('Missing or invalid globalRole claim', 403, 'FORBIDDEN');
    }
    const globalRole: GlobalRole = globalRoleRaw;

    ctx = {
      uid: decoded.uid,
      email: decoded.email || '',
      companyId,
      globalRole,
      mfaEnrolled: decoded.mfaEnrolled === true,
      isAuthenticated: true,
    };
  }

  const project = await requireProjectInTenant({ ctx, projectId, path });
  return { ctx, project };
}
