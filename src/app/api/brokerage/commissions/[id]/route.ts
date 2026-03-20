/**
 * =============================================================================
 * PATCH /api/brokerage/commissions/[id] — Update Payment Status
 * =============================================================================
 *
 * Server-side endpoint for updating commission payment status.
 * Enforces tenant isolation via companyId from AuthContext.
 *
 * @enterprise ADR-252 - Security Audit (server-side write enforcement)
 */
import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logFinancialTransition } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
import { BrokerageServerService } from '@/services/brokerage-server.service';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const UpdatePaymentSchema = z.object({
  paymentStatus: z.enum(['pending', 'paid', 'cancelled']),
});

type RouteContext = { params: Promise<{ id: string }> };

async function handlePatch(request: NextRequest, segmentData?: RouteContext): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { id } = await segmentData!.params;

        if (!id || typeof id !== 'string') {
          return NextResponse.json(
            { success: false, error: 'Commission ID is required' },
            { status: 400 }
          );
        }

        const parsed = safeParseBody(UpdatePaymentSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await BrokerageServerService.updateCommissionPayment(
          id,
          body.paymentStatus,
          ctx.companyId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        await logFinancialTransition(ctx, 'commission', id, 'unknown', body.paymentStatus).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true }, { status: 200 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update commission payment');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );
  return handler(request);
}

export const PATCH = withSensitiveRateLimit(handlePatch);
