/**
 * =============================================================================
 * POST /api/opportunities — Create Opportunity
 * =============================================================================
 *
 * Auth: withAuth (authenticated users)
 * Rate: withSensitiveRateLimit (financial/CRM data)
 *
 * @module api/opportunities
 * @enterprise ADR-252 Security Fix: Server-side validation
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { OpportunitiesServerService } from '@/services/opportunities-server.service';
import { getErrorMessage } from '@/lib/error-utils';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = await req.json();

        const result = await OpportunitiesServerService.create(
          body,
          ctx.companyId,
          ctx.uid
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { success: true, data: { id: result.id } },
          { status: 201 }
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create opportunity');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
