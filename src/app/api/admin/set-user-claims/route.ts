/**
 * =============================================================================
 * SET USER CUSTOM CLAIMS - ENTERPRISE ADMIN API
 * =============================================================================
 *
 * Admin endpoint για την προσθήκη custom claims σε Firebase user token.
 * Χρησιμοποιείται για να σετάρει companyId και globalRole στους χρήστες.
 *
 * @module api/admin/set-user-claims
 * @enterprise RFC v6 - Authorization & RBAC System
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: users:users:manage (company_admin or super_admin)
 * - Tenant Isolation: company_admin can only manage users in their company
 * - Super Admin Bypass: super_admin can manage users across all companies
 * - Comprehensive audit logging with logClaimsUpdated
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit, withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

import { handleSetUserClaims } from './claims-handler';
import type { SetUserClaimsResponse } from './types';

// ============================================================================
// POST — Set custom claims
// ============================================================================

/**
 * POST /api/admin/set-user-claims
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: users:users:manage
 * - Tenant Isolation: company_admin can only manage users in their company
 * - Super Admin Bypass: super_admin can manage any company
 * - Rate Limit: SENSITIVE (20 req/min) - Admin operation
 */
export const POST = withSensitiveRateLimit(
  withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<SetUserClaimsResponse>> => {
      return handleSetUserClaims(req, ctx);
    },
    { permissions: 'users:users:manage' }
  )
);

// ============================================================================
// GET — Health check
// ============================================================================

/**
 * GET /api/admin/set-user-claims
 *
 * Health check endpoint
 * Rate Limit: STANDARD (60 req/min)
 */
async function handleGet(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'Set User Claims Admin API',
    status: 'healthy',
    version: '2.1.0',
    security: 'AUTHZ Phase 2 - RBAC Protected',
    rateLimit: 'SENSITIVE (20 req/min for POST), STANDARD (60 req/min for GET)',
    endpoints: {
      POST: {
        description: 'Set custom claims for a user (admin only)',
        security: {
          authentication: 'Firebase Auth + withAuth middleware',
          permission: 'users:users:manage',
          roles: ['super_admin', 'company_admin'],
          tenantIsolation: 'company_admin can only manage users in their company',
          superAdminBypass: 'super_admin can manage users across all companies',
        },
        body: {
          uid: 'string (required) - Firebase Auth UID',
          companyId: 'string (required) - Target company ID',
          globalRole: 'GlobalRole (required)',
          email: 'string (required) - User email for verification',
          permissions: 'PermissionId[] (optional) - Additional explicit permissions',
        },
        auditLogging: 'All claims updates are logged to /companies/{companyId}/audit_logs',
      },
    },
  });
}

export const GET = withStandardRateLimit(handleGet);
