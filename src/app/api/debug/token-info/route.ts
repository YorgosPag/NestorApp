/**
 * 🐛 DEBUG ENDPOINT - Token Info
 *
 * TEMPORARY endpoint for debugging custom claims.
 * DELETE after verification!
 *
 * @route GET /api/debug/token-info
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Get current user's token info and custom claims
 */
export const GET = withAuth(
  async (_request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // Return all auth context for debugging
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: '🔐 Current Token Info',
      context: {
        uid: ctx.uid,
        email: ctx.email,
        globalRole: ctx.globalRole,
        companyId: ctx.companyId,
        permissions: ctx.permissions,
        mfaEnrolled: ctx.mfaEnrolled,
        // Additional debugging info
        raw: {
          hasCompanyId: !!ctx.companyId,
          hasPermissions: ctx.permissions.length > 0,
          globalRoleType: typeof ctx.globalRole,
        }
      }
    }, { status: 200 });
  }
);
