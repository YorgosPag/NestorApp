/**
 * =============================================================================
 * POST /api/brokerage/commissions — Record Commission
 * =============================================================================
 *
 * Server-side endpoint for recording brokerage commissions.
 * Commission calculation happens ONLY on the server.
 *
 * @enterprise ADR-252 - Security Audit (server-side write enforcement)
 */
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { BrokerageServerService } from '@/services/brokerage-server.service';
import type { RecordCommissionInput } from '@/types/brokerage';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = await req.json() as RecordCommissionInput;

        const result = await BrokerageServerService.recordCommission(
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
        const message = getErrorMessage(error, 'Failed to record commission');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
