/**
 * =============================================================================
 * AUTO-FIX MISSING COMPANIES — Route (AUTHZ Phase 2)
 * =============================================================================
 *
 * Auto-detects and fixes companies with projects that are missing from the
 * navigation collection. Execution lives in `./fix-handler.ts`; this file
 * only wires `withAuth` + permission gate around POST, plus an info GET.
 *
 * @method GET  Info endpoint (read-only)
 * @method POST Execute auto-fix (super_admin-only, audit-logged)
 *
 * @security Multi-layer:
 *   - Layer 1: withAuth (permission `admin:data:fix`)
 *   - Layer 2: super_admin role check inside the handler
 *   - Layer 3: Audit logging via `logDataFix`
 * =============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { handleAutoFixExecute, type AutoFixResult } from './fix-handler';

/**
 * POST — Execute auto-fix.
 *
 * @security withAuth + super_admin check (inside handler) + audit logging
 */
export const POST = withAuth(
  async (
    req: NextRequest,
    ctx: AuthContext,
    _cache: PermissionCache,
  ): Promise<NextResponse<AutoFixResult>> => {
    return handleAutoFixExecute(req, ctx);
  },
  { permissions: 'admin:data:fix' },
);

/**
 * GET — Info endpoint.
 *
 * @security withAuth + admin:data:fix permission
 */
export const GET = withAuth(
  async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
    return NextResponse.json({
      endpoint: 'Enterprise Navigation Auto-Fix',
      description:
        'Automatically detects and fixes companies with projects that are missing from navigation',
      usage: 'POST to this endpoint to run the auto-fix',
      methods: ['POST'],
      security: 'Requires super_admin role',
      requester: {
        email: ctx.email,
        globalRole: ctx.globalRole,
        hasAccess: ctx.globalRole === 'super_admin',
      },
    });
  },
  { permissions: 'admin:data:fix' },
);
