/**
 * =============================================================================
 * POST /api/brokerage/agreements — Create Brokerage Agreement
 * =============================================================================
 *
 * Server-side endpoint for creating brokerage agreements.
 * Enforces exclusivity validation and tenant isolation.
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
import type { CreateBrokerageAgreementInput } from '@/types/brokerage';

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = await req.json() as CreateBrokerageAgreementInput;

        const result = await BrokerageServerService.createAgreement(
          body,
          ctx.companyId,
          ctx.uid
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error, validation: result.validation ?? null },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { success: true, data: { id: result.id } },
          { status: 201 }
        );
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create brokerage agreement');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
